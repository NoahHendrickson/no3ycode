/**
 * Fork-owned — see `.fork/customizations.yaml#fork-bot-work-reports`.
 */
import { assert, it } from "@effect/vitest";
import {
  CommandId,
  EventId,
  MessageId,
  type OrchestrationV2DomainEvent,
  type OrchestrationV2Run,
  ProjectId,
  ProviderDriverKind,
  ProviderInstanceId,
  ProviderSessionId,
  RuntimeRequestId,
  ThreadId,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as TestClock from "effect/testing/TestClock";

import type * as ProviderAdapter from "@t3tools/provider-core/server/ProviderAdapter";
import * as SqlitePersistence from "../persistence/Sqlite.ts";
import { CodexProviderCapabilitiesV2 } from "./Adapters/CodexAdapterV2.ts";
import * as EffectOutbox from "./EffectOutbox.ts";
import * as ForkBotWorkReports from "./forkBotWorkReports.ts";
import * as Orchestrator from "./Orchestrator.ts";
import * as ProjectionStore from "./ProjectionStore.ts";
import * as ProviderAdapterRegistry from "./ProviderAdapterRegistry.ts";
import * as ProviderReplayHarness from "./testkit/ProviderReplayHarness.ts";

const instanceId = ProviderInstanceId.make("codex");
const modelSelection = { instanceId, model: "gpt-5.1-codex" };
const adapter = {
  instanceId,
  driver: ProviderDriverKind.make("codex"),
  getCapabilities: () => Effect.succeed(CodexProviderCapabilitiesV2),
  planSelectionTransition: () => Effect.succeed({ type: "apply_on_next_turn" as const }),
  openSession: () => Effect.die("No provider process needed"),
} as ProviderAdapter.ProviderAdapterV2["Service"];
const layerDatabase = SqlitePersistence.layerMemory;
const layerTest = Layer.mergeAll(
  layerDatabase,
  ProjectionStore.layer.pipe(Layer.provide(layerDatabase)),
  EffectOutbox.layer.pipe(Layer.provide(layerDatabase)),
  ProviderReplayHarness.layerWithRegistry(
    { name: "fork-bot-work-reports" },
    ProviderAdapterRegistry.layerFromAdapters([adapter]),
    { databaseLayer: layerDatabase, runEffectWorker: false },
  ),
);

it.effect(
  "tells a bot when its work settles a turn or waits on someone, once per queued notice",
  () =>
    Effect.gen(function* () {
      const orchestrator = yield* Orchestrator.OrchestratorV2;
      const projections = yield* ProjectionStore.ProjectionStoreV2;
      const reactor = yield* ForkBotWorkReports.ForkBotWorkReports;
      const projectId = ProjectId.make("project:bots");
      const botId = ThreadId.make("thread:bot");
      const workId = ThreadId.make("thread:work");
      const now = yield* DateTime.now;

      const create = (threadId: ThreadId, title: string, tag: string) =>
        Effect.gen(function* () {
          yield* orchestrator.dispatch({
            type: "thread.create",
            commandId: CommandId.make(`create:${threadId}`),
            threadId,
            projectId,
            title,
            modelSelection,
            runtimeMode: "full-access",
            interactionMode: "default",
            branch: null,
            worktreePath: null,
            createdBy: "user",
            creationSource: "web",
          });
          yield* orchestrator.dispatch({
            type: "thread.tag.set",
            commandId: CommandId.make(`tag:${threadId}`),
            threadId,
            tag,
            tagged: true,
          });
        });
      const send = (threadId: ThreadId, key: string, createdBy: "user" | "agent") =>
        orchestrator.dispatch({
          type: "message.dispatch",
          commandId: CommandId.make(`send:${key}`),
          threadId,
          messageId: MessageId.make(`message:${key}`),
          text: key,
          attachments: [],
          dispatchMode: { type: "queue_after_active" },
          createdBy,
          creationSource: createdBy === "user" ? "web" : "mcp",
        });
      const runFor = (threadId: ThreadId, key: string) =>
        projections
          .getThreadRecords(threadId, ["runs"])
          .pipe(
            Effect.map(({ runs }) => runs.find((run) => run.userMessageId === `message:${key}`)!),
          );
      const settled = (
        run: OrchestrationV2Run,
        status: "completed" | "failed",
        completedAt = now,
      ) =>
        ({
          id: EventId.make(`event:${run.id}:${status}`),
          type: "run.updated",
          threadId: run.threadId,
          runId: run.id,
          occurredAt: completedAt,
          payload: { ...run, status, completedAt },
        }) satisfies OrchestrationV2DomainEvent;
      const reports = projections.getThreadRecords(botId, ["messages", "runs"]).pipe(
        Effect.map(({ messages, runs }) =>
          messages
            .filter((message) => message.id.startsWith("message:fork-bot-work-report:"))
            .map((message) => ({
              message,
              status: runs.find((run) => run.userMessageId === message.id)?.status,
            })),
        ),
      );

      yield* create(botId, "Scout", "bot");
      // The owner is mid-chat with the bot, so its notices queue behind that turn.
      yield* send(botId, "owner-chat", "user");
      yield* create(workId, "Fix the flaky test", `bot-work:${botId}`);
      yield* send(workId, "bot-launch", "agent");
      yield* send(workId, "owner-follow-up", "user");
      const botRun = yield* runFor(workId, "bot-launch");
      const ownerRun = yield* runFor(workId, "owner-follow-up");

      // A turn the owner watched from the thread still reaches the bot, quietly.
      yield* reactor.handle(settled(ownerRun, "completed"));
      yield* orchestrator.dispatch({
        type: "thread.visit",
        commandId: CommandId.make("visit-work"),
        threadId: workId,
        visitedAt: DateTime.formatIso(now),
      });
      yield* TestClock.adjust(ForkBotWorkReports.FORK_BOT_OWNER_WATCH_GRACE);
      assert.lengthOf(yield* reports, 0);
      const seen = (yield* projections.getThreadRecords(botId, ["messages"])).messages.filter(
        (message) => message.id.startsWith("message:fork-bot-work-seen:"),
      );
      assert.lengthOf(seen, 1);
      assert.include(seen[0]?.text, 'reply with exactly "Nothing to report."');
      // A quiet notice can stand for several watched threads, so it sends the bot to all of them.
      assert.include(seen[0]?.text, "Your other threads may have changed too");
      assert.equal(seen[0]?.notification?.summary, "Fix the flaky test finished while you watched");

      // An archived bot is asleep.
      yield* orchestrator.dispatch({
        type: "thread.archive",
        commandId: CommandId.make("archive-bot"),
        threadId: botId,
      });
      yield* reactor.handle(settled(botRun, "completed"));
      assert.lengthOf(yield* reports, 0);
      yield* orchestrator.dispatch({
        type: "thread.unarchive",
        commandId: CommandId.make("unarchive-bot"),
        threadId: botId,
      });

      // A queued quiet notice tells the bot to say nothing, so it never covers a real report.
      yield* reactor.handle(settled(botRun, "completed"));
      yield* reactor.handle(settled(botRun, "completed"));
      const [first] = yield* reports;
      assert.lengthOf(yield* reports, 1);
      assert.equal(first?.status, "queued");
      assert.include(first?.message.text, `Work report: your thread "Fix the flaky test"`);
      assert.include(first?.message.text, "not from your owner");
      assert.deepEqual(first?.message.notification, {
        source: { kind: "system" },
        outcome: "updated",
        summary: "Fix the flaky test finished",
        detail: first!.message.text,
      });
      assert.equal(first?.message.createdBy, "agent");

      // The queued notice already sends the bot to look at all of its work.
      const question = {
        id: EventId.make("event:question"),
        type: "runtime-request.updated",
        threadId: workId,
        runId: botRun.id,
        occurredAt: now,
        payload: {
          id: RuntimeRequestId.make("request:question"),
          nodeId: botRun.rootNodeId!,
          providerTurnId: null,
          nativeRequestRef: null,
          kind: "user_input",
          status: "pending",
          responseCapability: {
            type: "live",
            providerSessionId: ProviderSessionId.make("session:work"),
          },
          createdAt: now,
          resolvedAt: null,
        },
      } satisfies OrchestrationV2DomainEvent;
      yield* reactor.handle(settled(botRun, "failed"));
      yield* reactor.handle(question);
      assert.lengthOf(yield* reports, 1);

      // Once that notice is gone, the next one goes out.
      const firstRun = (yield* projections.getThreadRecords(botId, ["runs"])).runs.find(
        (run) => run.userMessageId === first!.message.id,
      )!;
      yield* orchestrator.dispatch({
        type: "queued-run.cancel",
        commandId: CommandId.make("cancel-first-report"),
        threadId: botId,
        runId: firstRun.id,
      });
      yield* reactor.handle(question);
      const second = (yield* reports).find((report) => report.message.id !== first!.message.id);
      assert.equal(second?.status, "queued");
      assert.include(second?.message.text, "requestId request:question");
      assert.equal(second?.message.notification?.summary, "Fix the flaky test has a question");

      // An owner turn that settles after they left the thread reports once the grace is up.
      const secondRun = (yield* projections.getThreadRecords(botId, ["runs"])).runs.find(
        (run) => run.userMessageId === second!.message.id,
      )!;
      yield* orchestrator.dispatch({
        type: "queued-run.cancel",
        commandId: CommandId.make("cancel-second-report"),
        threadId: botId,
        runId: secondRun.id,
      });
      yield* reactor.handle(settled(ownerRun, "failed", yield* DateTime.now));
      assert.lengthOf(yield* reports, 2);
      yield* TestClock.adjust(ForkBotWorkReports.FORK_BOT_OWNER_WATCH_GRACE);
      const third = (yield* reports).find(
        (report) => report.message.notification?.summary === "Fix the flaky test failed",
      );
      assert.equal(third?.status, "queued");
    }).pipe(Effect.provide(ForkBotWorkReports.layer.pipe(Layer.provideMerge(layerTest)))),
);

it("names the bot a listed thread works for, never a subagent's or side chat's", () => {
  const botId = ThreadId.make("thread:bot");
  const lineage = { parentThreadId: null, relationshipToParent: null, rootThreadId: botId };
  const tags = [`bot-work:${botId}`];
  assert.equal(ForkBotWorkReports.forkBotWorkOwnerId({ tags, lineage }), botId);
  assert.isNull(ForkBotWorkReports.forkBotWorkOwnerId({ tags: [], lineage }));
  assert.isNull(
    ForkBotWorkReports.forkBotWorkOwnerId({
      tags,
      lineage: { ...lineage, parentThreadId: botId, relationshipToParent: "subagent" },
    }),
  );
  assert.isNull(
    ForkBotWorkReports.forkBotWorkOwnerId({ tags, lineage: { ...lineage, sideChat: true } }),
  );
});
