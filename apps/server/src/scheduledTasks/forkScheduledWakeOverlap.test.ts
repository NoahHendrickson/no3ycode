/**
 * Fork-owned — see `.fork/customizations.yaml#fork-bots`.
 */
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { expect, it } from "@effect/vitest";
import { ScheduledTaskUpsertInput } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as TestClock from "effect/testing/TestClock";

import * as ThreadLaunchService from "../orchestration-v2/ThreadLaunchService.ts";
import * as ThreadManagementService from "../orchestration-v2/ThreadManagementService.ts";
import * as SqlitePersistence from "../persistence/Sqlite.ts";
import * as ManagedPolicy from "../policy/ManagedPolicy.ts";
import * as ManagedProjectFolders from "../project/ManagedProjectFolders.ts";
import * as Scheduler from "../scheduling/Scheduler.ts";
import * as SecretRequests from "../secrets/SecretRequests.ts";
import * as ScheduledTaskService from "./ScheduledTaskService.ts";

const decodeUpsertInput = Schema.decodeUnknownEffect(ScheduledTaskUpsertInput);
const THREAD_ID = "thread-bot";

it.effect("skips a bound task's fire while its earlier wake is unfinished", () =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const sent = yield* Ref.make<ReadonlyArray<string>>([]);
    // Each wake leaves a run the thread has not finished, as a bot held up on a question would.
    const sendToThread = (input: { readonly messageId: string }) =>
      Effect.gen(function* () {
        const ordinal = (yield* Ref.updateAndGet(sent, (ids) => [...ids, input.messageId])).length;
        yield* sql`INSERT INTO orchestration_v2_projection_runs ${sql.insert({
          run_id: `run:${ordinal}`,
          thread_id: THREAD_ID,
          ordinal,
          provider: "claudeAgent",
          provider_thread_id: null,
          status: "waiting",
          requested_at: "2026-11-13T00:00:00.000Z",
          completed_at: null,
          payload_json: JSON.stringify({ userMessageId: input.messageId }),
        })}`.pipe(Effect.orDie);
        return { delivery: "queued" } as never;
      });
    const dependencies = Layer.mergeAll(
      NodeCrypto.layer,
      Scheduler.layer,
      ManagedPolicy.layerTest(),
      Layer.mock(ThreadLaunchService.ThreadLaunchService)({}),
      Layer.mock(ManagedProjectFolders.ManagedProjectFolders)({
        namedProjectsRoot: "/projects",
        isScratchProject: () => Effect.succeed(false),
      }),
      Layer.mock(ThreadManagementService.ThreadManagementService)({ sendToThread }),
      Layer.mock(SecretRequests.SecretRequests)({}),
    );
    yield* Effect.gen(function* () {
      const service = yield* ScheduledTaskService.ScheduledTaskService;
      yield* service.upsert(
        yield* decodeUpsertInput({
          title: "Morning check",
          prompt: "Run the morning check.",
          enabled: true,
          schedule: { type: "interval", everyMs: 60_000 },
          projectId: "project-bots",
          threadId: THREAD_ID,
          threadMode: "fresh_session",
          workspaceStrategy: { type: "root" },
          modelSelection: { instanceId: "claudeAgent", model: "claude-haiku-5-5" },
          runtimeMode: "full-access",
          interactionMode: "default",
        }),
      );
      const fire = TestClock.adjust("6 seconds").pipe(
        Effect.andThen(TestClock.adjust("60 seconds")),
      );
      yield* fire;
      expect(yield* Ref.get(sent)).toHaveLength(1);

      // Two more intervals pass while the first wake is still waiting: nothing queues behind it.
      yield* fire;
      yield* fire;
      expect(yield* Ref.get(sent)).toHaveLength(1);

      // Once that wake finishes, the next interval fires as usual.
      yield* sql`UPDATE orchestration_v2_projection_runs SET status = 'completed'`;
      yield* fire;
      expect(yield* Ref.get(sent)).toHaveLength(2);
    }).pipe(Effect.provide(ScheduledTaskService.layer.pipe(Layer.provide(dependencies))));
  }).pipe(Effect.provide(SqlitePersistence.layerMemory)),
);
