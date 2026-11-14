/**
 * Fork-owned — see `.fork/customizations.yaml#fork-scheduled-wake-hold`.
 */
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { expect, it } from "@effect/vitest";
import { ScheduledTaskUpsertInput } from "@t3tools/contracts";
import * as Clock from "effect/Clock";
import * as DateTime from "effect/DateTime";
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

it.effect(
  "holds a bot's wake while its earlier wake is unfinished, it is limited or its owner chats with it, and only a bot's",
  () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const sent = yield* Ref.make<ReadonlyArray<string>>([]);
      const usageLimitResetAt = yield* Ref.make<string | null>(null);
      const tags = yield* Ref.make<ReadonlyArray<string>>(["bot"]);
      const getThreadShell = () =>
        Effect.all([Ref.get(tags), Ref.get(usageLimitResetAt)]).pipe(
          Effect.map(
            ([threadTags, resetAt]) =>
              ({
                tags: threadTags,
                lastErrorClass: resetAt === null ? null : "usage_limit",
                usageLimitResetAt: resetAt,
              }) as never,
          ),
        );
      const sentInputs = yield* Ref.make<
        ReadonlyArray<ThreadManagementService.ThreadManagementSendInput>
      >([]);
      // Each wake leaves a run the thread has not finished, as a bot held up on a question would.
      const sendToThread = (input: ThreadManagementService.ThreadManagementSendInput) =>
        Effect.gen(function* () {
          yield* Ref.update(sentInputs, (inputs) => [...inputs, input]);
          const ordinal = (yield* Ref.updateAndGet(sent, (ids) => [...ids, input.messageId]))
            .length;
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
        Layer.mock(ThreadManagementService.ThreadManagementService)({
          sendToThread,
          getThreadShell,
        }),
        Layer.mock(SecretRequests.SecretRequests)({}),
      );
      yield* Effect.gen(function* () {
        const service = yield* ScheduledTaskService.ScheduledTaskService;
        yield* service.upsert(
          yield* decodeUpsertInput({
            title: "Morning check",
            // As the MCP tools save a bot's own task.
            prompt: "Scheduled wake: Run the morning check.",
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
        // A marked wake runs on its task's model, not on whatever the conversation was switched to.
        expect((yield* Ref.get(sentInputs))[0]?.modelSelection).toEqual({
          instanceId: "claudeAgent",
          model: "claude-haiku-5-5",
        });

        // Two more intervals pass while the first wake is still waiting: nothing queues behind it.
        yield* fire;
        yield* fire;
        expect(yield* Ref.get(sent)).toHaveLength(1);

        // Once that wake finishes, the next interval fires as usual.
        yield* sql`UPDATE orchestration_v2_projection_runs SET status = 'completed'`;
        yield* fire;
        expect(yield* Ref.get(sent)).toHaveLength(2);

        // A thread limited until a reset still ahead skips its fires instead of hitting the limit.
        yield* sql`UPDATE orchestration_v2_projection_runs SET status = 'failed'`;
        yield* Ref.set(usageLimitResetAt, "2999-01-01T00:00:00.000Z");
        yield* fire;
        yield* fire;
        expect(yield* Ref.get(sent)).toHaveLength(2);

        // Once that reset has passed, the next interval fires again.
        yield* Ref.set(usageLimitResetAt, "1970-01-01T00:00:00.000Z");
        yield* fire;
        expect(yield* Ref.get(sent)).toHaveLength(3);

        // A thread that is not a bot keeps upstream's queueing: its fire goes out behind the
        // still-waiting third wake.
        yield* Ref.set(tags, []);
        yield* fire;
        expect(yield* Ref.get(sent)).toHaveLength(4);

        // A bot in a chat defers its wake a few minutes instead of skipping to its next slot.
        yield* Ref.set(tags, ["bot"]);
        yield* sql`UPDATE orchestration_v2_projection_runs SET status = 'completed'`;
        const insertMessage = (messageId: string) =>
          Clock.currentTimeMillis.pipe(
            Effect.flatMap((nowMs) => {
              const at = DateTime.formatIso(DateTime.makeUnsafe(nowMs));
              return sql`INSERT INTO orchestration_v2_projection_messages ${sql.insert({
                message_id: messageId,
                thread_id: THREAD_ID,
                run_id: null,
                node_id: null,
                role: "user",
                streaming: 0,
                created_at: at,
                updated_at: at,
                payload_json: JSON.stringify({ createdBy: "user" }),
              })}`;
            }),
          );
        // An owner-made task's wake is authored by `user` too, but it is no chat.
        yield* insertMessage("scheduled-task-message:other-task:1");
        yield* fire;
        expect(yield* Ref.get(sent)).toHaveLength(5);

        yield* sql`UPDATE orchestration_v2_projection_runs SET status = 'completed'`;
        yield* insertMessage("message:owner");
        yield* fire;
        expect(yield* Ref.get(sent)).toHaveLength(5);
        const deferredTo = Date.parse((yield* service.list()).tasks[0]?.nextRunAt ?? "");
        const now = yield* Clock.currentTimeMillis;
        // Past the next 60-second slot a skip would have picked, and within the 5-minute deferral.
        expect(deferredTo).toBeGreaterThan(now + 60_000);
        expect(deferredTo).toBeLessThanOrEqual(now + 5 * 60_000);

        // Ten minutes after the owner's message, the deferred wake goes out.
        yield* TestClock.adjust("11 minutes");
        expect(yield* Ref.get(sent)).toHaveLength(6);

        // Any unfinished run of the bot, such as the owner's own turn, defers it too.
        yield* sql`UPDATE orchestration_v2_projection_runs SET status = 'completed'`;
        yield* sql`INSERT INTO orchestration_v2_projection_runs ${sql.insert({
          run_id: "run:owner",
          thread_id: THREAD_ID,
          ordinal: 100,
          provider: "claudeAgent",
          provider_thread_id: null,
          status: "running",
          requested_at: "2026-11-13T00:00:00.000Z",
          completed_at: null,
          payload_json: JSON.stringify({ userMessageId: "message:owner-2" }),
        })}`;
        yield* fire;
        yield* fire;
        expect(yield* Ref.get(sent)).toHaveLength(6);
        yield* sql`UPDATE orchestration_v2_projection_runs SET status = 'completed'`;
        yield* TestClock.adjust("5 minutes");
        expect(yield* Ref.get(sent)).toHaveLength(7);
      }).pipe(Effect.provide(ScheduledTaskService.layer.pipe(Layer.provide(dependencies))));
    }).pipe(Effect.provide(SqlitePersistence.layerMemory)),
);
