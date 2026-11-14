// Fork test — see `.fork/customizations.yaml#fork-bot-event-wakes`.
import * as NodePlatformCrypto from "@effect/platform-node/NodeCrypto";
import { assert, it } from "@effect/vitest";
import {
  type OrchestrationV2ThreadShell,
  ProjectId,
  ScheduledTaskUpsertInput,
  ThreadId,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Queue from "effect/Queue";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";

import * as ThreadLaunchService from "../orchestration-v2/ThreadLaunchService.ts";
import * as ThreadManagementService from "../orchestration-v2/ThreadManagementService.ts";
import * as SqlitePersistence from "../persistence/Sqlite.ts";
import * as ManagedPolicy from "../policy/ManagedPolicy.ts";
import * as ManagedProjectFolders from "../project/ManagedProjectFolders.ts";
import * as Scheduler from "../scheduling/Scheduler.ts";
import * as SecretRequests from "../secrets/SecretRequests.ts";
import { forkThreadEventFromDomainEvent, forkThreadEventsToStore } from "./forkThreadEventWakes.ts";
import * as ScheduledTaskService from "./ScheduledTaskService.ts";

const decodeUpsertInput = Schema.decodeUnknownEffect(ScheduledTaskUpsertInput);

type Shell = Pick<
  OrchestrationV2ThreadShell,
  "id" | "projectId" | "tags" | "lineage" | "archivedAt" | "title" | "lastError"
>;
const shell = (id: string, overrides: Partial<Shell> = {}): Shell => ({
  id: ThreadId.make(id),
  projectId: ProjectId.make("project-site"),
  title: `Thread ${id}`,
  tags: [],
  lineage: { parentThreadId: null, relationshipToParent: null, rootThreadId: ThreadId.make(id) },
  archivedAt: null,
  lastError: "Provider error 503",
  ...overrides,
});

it("reads only finishes, failures and requests for the user off the domain events", () => {
  const run = (status: string, userMessageId = "message-1") =>
    forkThreadEventFromDomainEvent({
      type: "run.updated",
      threadId: "thread-a",
      payload: { id: "run-1", status, userMessageId },
    } as never);
  assert.deepEqual(run("completed"), {
    kind: "finished",
    threadId: ThreadId.make("thread-a"),
    runId: "run-1",
    requestId: null,
  });
  assert.equal(run("failed")?.kind, "failed");
  assert.isNull(run("running"));
  // A run an automation started (its own wake included) never wakes an automation.
  assert.isNull(run("completed", "scheduled-task-message:scheduled-task:watch:webhook:d-1"));
  const request = (kind: string, status = "pending") =>
    forkThreadEventFromDomainEvent({
      type: "runtime-request.updated",
      threadId: "thread-a",
      payload: { id: "request-1", kind, status },
    } as never);
  assert.equal(request("user_input")?.kind, "needs_you");
  assert.isNull(request("user_input", "resolved"));
  assert.isNull(request("dynamic_tool_call"));
  // Saving: omitted keeps what is stored, null clears it.
  const stored = { events: ["failed" as const] };
  assert.deepEqual(forkThreadEventsToStore(undefined, stored), { threadEvents: stored });
  assert.deepEqual(forkThreadEventsToStore(null, stored), {});
});

it.effect("posts a thread event once to each matching task, never into an automation loop", () =>
  Effect.gen(function* () {
    const launches = yield* Queue.unbounded<ThreadLaunchService.ThreadLaunchInput>();
    const shells = new Map<string, Shell>([
      ["thread-site", shell("thread-site")],
      ["thread-other", shell("thread-other", { projectId: ProjectId.make("project-other") })],
      ["thread-bot", shell("thread-bot", { tags: ["bot"] })],
      // Threads automations posted into: a new_thread task's own run, and a user thread
      // another task is bound to.
      ["thread-run", shell("thread-run")],
      ["thread-bound", shell("thread-bound")],
      [
        "thread-child",
        shell("thread-child", {
          lineage: {
            parentThreadId: ThreadId.make("thread-site"),
            relationshipToParent: "subagent",
            rootThreadId: ThreadId.make("thread-site"),
          },
        }),
      ],
    ]);
    let secretConsumed = false;
    const dependencies = Layer.mergeAll(
      NodePlatformCrypto.layerDigest,
      NodePlatformCrypto.layerMac,
      NodePlatformCrypto.layer,
      Scheduler.layer,
      Layer.mock(ThreadLaunchService.ThreadLaunchService)({
        launch: (input) =>
          Queue.offer(launches, input).pipe(
            Effect.as({ threadId: "thread-run", resumed: false } as never),
          ),
      }),
      Layer.mock(ManagedProjectFolders.ManagedProjectFolders)({
        namedProjectsRoot: "/projects",
        isScratchProject: () => Effect.succeed(false),
      }),
      Layer.mock(ThreadManagementService.ThreadManagementService)({
        getThreadShell: (threadId) => Effect.succeed((shells.get(threadId) ?? null) as never),
      }),
      Layer.mock(SecretRequests.SecretRequests)({
        consume: () =>
          Effect.sync(() => {
            secretConsumed = true;
            return "s3cret";
          }),
      }),
      Layer.succeed(
        ScheduledTaskService.ScheduledTaskWebhookOrigin,
        Effect.succeed({ relayHookBaseUrl: null }),
      ),
      ManagedPolicy.layerTest(),
    );
    yield* Effect.gen(function* () {
      const service = yield* ScheduledTaskService.ScheduledTaskService;
      const sql = yield* SqlClient.SqlClient;
      for (const [messageId, threadId] of [
        ["scheduled-task-message:scheduled-task:watch-site:webhook:d-0", "thread-run"],
        ["scheduled-task-message:scheduled-task:nightly:2026-11-13T09:00", "thread-bound"],
      ]) {
        yield* sql`INSERT INTO orchestration_v2_projection_messages ${sql.insert({
          message_id: messageId,
          thread_id: threadId,
          run_id: null,
          node_id: null,
          role: "user",
          streaming: 0,
          created_at: "2026-11-13T09:00:00.000Z",
          updated_at: "2026-11-13T09:00:00.000Z",
          payload_json: "{}",
        })}`;
      }
      const { task } = yield* service.upsert(
        yield* decodeUpsertInput({
          id: "scheduled-task:watch-site",
          title: "Watch the site",
          prompt: "{{body.title}} {{body.event}}: {{body.error}}",
          enabled: true,
          schedule: {
            type: "webhook",
            threadEvents: { events: ["failed"], projectIds: ["project-site"] },
          },
          projectId: "project-bots",
          workspaceStrategy: { type: "root" },
          modelSelection: { instanceId: "claudeAgent", model: "claude-haiku-5-5" },
          runtimeMode: "full-access",
          interactionMode: "default",
        }),
      );
      // Re-saving without the field keeps it, as an older client would.
      const resaved = yield* service.upsert(
        yield* decodeUpsertInput({
          id: task.id,
          title: "Watch the site",
          prompt: "{{body.title}} {{body.event}}: {{body.error}}",
          enabled: true,
          schedule: { type: "webhook" },
          projectId: "project-bots",
          workspaceStrategy: { type: "root" },
          modelSelection: { instanceId: "claudeAgent", model: "claude-haiku-5-5" },
          runtimeMode: "full-access",
          interactionMode: "default",
        }),
      );
      assert.deepEqual(
        resaved.task.schedule.type === "webhook" && resaved.task.schedule.threadEvents,
        { events: ["failed"], projectIds: [ProjectId.make("project-site")] },
      );

      const failed = (threadId: string, runId = "run-1") =>
        service.deliverThreadEvent({
          kind: "failed",
          threadId: ThreadId.make(threadId),
          runId,
          requestId: null,
        });
      yield* failed("thread-site");
      const launched = yield* Queue.take(launches);
      assert.include(launched.initialMessage?.text ?? "", "Thread thread-site");
      assert.include(launched.initialMessage?.text ?? "", "Provider error 503");
      // The same event again is a duplicate; a finish, another project, a bot or an agent's
      // thread never reaches the task.
      yield* failed("thread-site");
      yield* service.deliverThreadEvent({
        kind: "finished",
        threadId: ThreadId.make("thread-site"),
        runId: "run-2",
        requestId: null,
      });
      yield* failed("thread-other");
      yield* failed("thread-bot");
      yield* failed("thread-child");
      yield* failed("thread-run");
      // A usage-limit continuation and a question in a bound thread carry no scheduled id of
      // their own; the thread still never wakes an automation.
      yield* failed("thread-bound", "run-limit-resume");
      yield* service.deliverThreadEvent({
        kind: "needs_you",
        threadId: ThreadId.make("thread-bound"),
        runId: null,
        requestId: "request-1",
      });
      const { deliveries } = yield* service.listWebhookDeliveries({
        id: task.id,
        acceptAnyOutcome: true,
      });
      // Duplicates are never logged, so one accepted delivery and no second launch is "once".
      assert.deepEqual(
        deliveries.map((delivery) => delivery.outcome),
        ["accepted"],
      );
      assert.equal(yield* Queue.size(launches), 0);

      // T3 posts thread events unsigned, so a signature check can't be added to them.
      const refused = yield* service
        .upsert(
          yield* decodeUpsertInput({
            id: "scheduled-task:signed",
            title: "Signed",
            prompt: "{{body.event}}",
            enabled: true,
            schedule: {
              type: "webhook",
              threadEvents: { events: ["failed"] },
              signature: {
                header: "X-Sig",
                encoding: "hex",
                prefix: "",
                secretRef: "secret-ref-1",
              },
            },
            projectId: "project-bots",
            workspaceStrategy: { type: "root" },
            modelSelection: { instanceId: "claudeAgent", model: "claude-haiku-5-5" },
            runtimeMode: "full-access",
            interactionMode: "default",
          }),
        )
        .pipe(Effect.flip);
      assert.include(refused.message, "can't be combined with a signature check");
      // Refused before the one-time secret reference is spent, so a corrected save can use it.
      assert.isFalse(secretConsumed);
    }).pipe(
      Effect.provide(Layer.fresh(ScheduledTaskService.layer.pipe(Layer.provide(dependencies)))),
    );
  }).pipe(Effect.provide(SqlitePersistence.layerMemory)),
);
