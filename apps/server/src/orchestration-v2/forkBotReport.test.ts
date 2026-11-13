// Fork test — see `.fork/customizations.yaml#fork-bots`.
import { assert, it } from "@effect/vitest";
import {
  EventId,
  MessageId,
  NodeId,
  ProjectId,
  ProviderDriverKind,
  ProviderInstanceId,
  RunId,
  ThreadId,
  type ModelSelection,
  type OrchestrationV2RunStatus,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as SqlitePersistence from "../persistence/Sqlite.ts";
import * as ProjectionStore from "./ProjectionStore.ts";

const layerTest = Layer.mergeAll(
  ProjectionStore.layer.pipe(Layer.provideMerge(SqlitePersistence.layerMemory)),
  SqlitePersistence.layerMemory,
);
const modelSelection = {
  instanceId: ProviderInstanceId.make("codex"),
  model: "gpt-5.4",
} satisfies ModelSelection;

it.layer(layerTest)("fork-bots shell report", (it) => {
  it.effect(
    "gives only a bot's shell the head of its latest settled report, skipping quiet wakes",
    () =>
      Effect.gen(function* () {
        const store = yield* ProjectionStore.ProjectionStoreV2;
        const now = yield* DateTime.now;
        const later = (seconds: number) => DateTime.add(now, { seconds });
        const createThread = (id: ThreadId, tags: ReadonlyArray<string>) =>
          store.apply({
            id: EventId.make(`event:${id}:created`),
            type: "thread.created",
            threadId: id,
            occurredAt: now,
            payload: {
              createdBy: "user",
              creationSource: "web",
              id,
              projectId: ProjectId.make("project:fork-bots"),
              title: id,
              providerInstanceId: modelSelection.instanceId,
              modelSelection,
              runtimeMode: "full-access",
              interactionMode: "default",
              branch: null,
              worktreePath: null,
              activeProviderThreadId: null,
              lineage: { parentThreadId: null, relationshipToParent: null, rootThreadId: id },
              forkedFrom: null,
              tags: [...tags],
              createdAt: now,
              updatedAt: now,
              archivedAt: null,
              settledOverride: null,
              settledAt: null,
              lastVisitedAt: null,
              deletedAt: null,
            },
          });
        const run = (threadId: ThreadId, ordinal: number, status: OrchestrationV2RunStatus) => {
          const runId = RunId.make(`run:${threadId}:${ordinal}`);
          const rootNodeId = NodeId.make(`node:${threadId}:${ordinal}`);
          return store.apply({
            id: EventId.make(`event:${threadId}:run-${ordinal}-${status}`),
            type: status === "running" ? "run.created" : "run.updated",
            threadId,
            runId,
            nodeId: rootNodeId,
            driver: ProviderDriverKind.make("codex"),
            providerInstanceId: modelSelection.instanceId,
            occurredAt: later(ordinal * 10),
            payload: {
              id: runId,
              threadId,
              ordinal,
              providerInstanceId: modelSelection.instanceId,
              modelSelection,
              providerThreadId: null,
              userMessageId: MessageId.make(`message:${threadId}:wake-${ordinal}`),
              rootNodeId,
              activeAttemptId: null,
              status,
              requestedAt: later(ordinal * 10),
              startedAt: later(ordinal * 10),
              completedAt: status === "running" ? null : later(ordinal * 10 + 9),
              checkpointId: null,
              contextHandoffId: null,
            },
          });
        };
        const message = (
          threadId: ThreadId,
          suffix: string,
          input: {
            role: "user" | "assistant";
            text: string;
            streaming: boolean;
            at: number;
            run: number | null;
          },
        ) =>
          store.apply({
            id: EventId.make(`event:${threadId}:${suffix}`),
            type: "message.updated",
            threadId,
            occurredAt: later(input.at),
            payload: {
              id: MessageId.make(`message:${threadId}:${suffix}`),
              threadId,
              runId: input.run === null ? null : RunId.make(`run:${threadId}:${input.run}`),
              nodeId: null,
              role: input.role,
              text: input.text,
              attachments: [],
              streaming: input.streaming,
              createdBy: input.role === "user" ? "user" : "agent",
              creationSource: "web",
              createdAt: later(input.at),
              updatedAt: later(input.at),
            },
          });

        const bot = ThreadId.make("thread:fork-bots:bot");
        const plain = ThreadId.make("thread:fork-bots:plain");
        yield* createThread(bot, ["mascot:Maple", "bot"]);
        yield* createThread(plain, []);
        const report = `Inbox: 3 new from Sam\n${"x".repeat(400)}`;
        yield* run(bot, 1, "running");
        yield* message(bot, "report", {
          role: "assistant",
          text: report,
          streaming: false,
          at: 11,
          run: 1,
        });
        yield* run(bot, 1, "completed");
        yield* run(plain, 1, "running");
        yield* message(plain, "reply", {
          role: "assistant",
          text: "Done",
          streaming: false,
          at: 11,
          run: 1,
        });
        yield* run(plain, 1, "completed");
        // A wake under way: its finished progress reply, a reply still streaming and the user's
        // next message are none of them a report, so the last settled report stands.
        yield* run(bot, 2, "running");
        yield* message(bot, "progress", {
          role: "assistant",
          text: "Checking your inbox",
          streaming: false,
          at: 21,
          run: 2,
        });
        yield* message(bot, "draft", {
          role: "assistant",
          text: "Still",
          streaming: true,
          at: 22,
          run: 2,
        });
        yield* message(bot, "ask", {
          role: "user",
          text: "Anything else?",
          streaming: false,
          at: 23,
          run: null,
        });

        const expected = report.slice(0, 280);
        const botShell = yield* store.getThreadShell(bot);
        assert.equal(botShell?.latestVisibleMessage?.role, "assistant");
        assert.equal(botShell?.latestVisibleMessage?.text, expected);
        assert.isNull((yield* store.getThreadShell(plain))?.latestVisibleMessage ?? null);
        const snapshot = yield* store.getShellSnapshot();
        assert.equal(
          snapshot.threads.find((thread) => thread.id === bot)?.latestVisibleMessage?.text,
          expected,
        );
        assert.equal(
          ProjectionStore.threadShellFromProjection(yield* store.getThreadProjection(bot))
            .latestVisibleMessage?.text,
          expected,
        );

        // A wake that settles on the quiet reply leaves the earlier report standing, and its
        // progress reply never takes its place.
        yield* message(bot, "quiet", {
          role: "assistant",
          text: " nothing to report \n",
          streaming: false,
          at: 25,
          run: 2,
        });
        yield* run(bot, 2, "completed");
        const afterQuiet = yield* store.getThreadShell(bot);
        assert.equal(afterQuiet?.latestVisibleMessage?.text, expected);
        assert.equal(
          ProjectionStore.threadShellFromProjection(yield* store.getThreadProjection(bot))
            .latestVisibleMessage?.text,
          expected,
        );

        // The next wake that finds something is the new report.
        yield* run(bot, 3, "running");
        yield* message(bot, "news", {
          role: "assistant",
          text: "Rent is due",
          streaming: false,
          at: 31,
          run: 3,
        });
        yield* run(bot, 3, "completed");
        assert.equal((yield* store.getThreadShell(bot))?.latestVisibleMessage?.text, "Rent is due");
      }),
  );
});
