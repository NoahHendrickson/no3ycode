/**
 * When a bot's scheduled wake is held — see `.fork/customizations.yaml#fork-scheduled-wake-hold`.
 * A bound task queues each fire behind whatever its thread is doing, so a bot held up for a day
 * would otherwise collect a day of wakes and run them back to back, a usage-limited one would
 * hit the limit every interval, and a wake during a chat would start a fresh session under it.
 */
import type {
  OrchestrationV2ThreadShell,
  ScheduledTask,
  ScheduledTaskId,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import type * as SqlClient from "effect/sql/SqlClient";
import { ScheduledTaskError } from "@t3tools/contracts";

import { isForkBotThread } from "@t3tools/shared/forkBotTags";
import { escapeGlobPrefix } from "./forkScheduledTaskRuns.ts";

/** Must match the message ids ScheduledTaskService mints for each fire. */
const SCHEDULED_TASK_MESSAGE_PREFIX = "scheduled-task-message:";

const UNFINISHED_RUN_STATUSES = ["preparing", "queued", "starting", "running", "waiting"];

/** How long after the owner's last message a bot counts as in a chat. */
const FORK_BOT_CHAT_WINDOW_MS = 10 * 60_000;

/** How far a wake held for a chat moves, so a daily bot still wakes that day. */
const FORK_BOT_CHAT_DEFER_MS = 5 * 60_000;

/** `skip` moves the fire to its next regular slot; `defer` retries it a few minutes later. */
export type ForkScheduledFireHold = "run" | "skip" | "defer";

const holdCheckError = (taskId: ScheduledTaskId) => (cause: unknown) =>
  new ScheduledTaskError({ message: "Could not check the task's thread.", taskId, cause });

/** Whether a wake `taskId` sent into `threadId` is still queued or running. Runs name the message
    that started them, and every fire's message id starts with its task. */
function hasUnfinishedScheduledRun(
  sql: SqlClient.SqlClient,
  taskId: ScheduledTaskId,
  threadId: string,
): Effect.Effect<boolean, ScheduledTaskError> {
  const pattern = `${escapeGlobPrefix(`${SCHEDULED_TASK_MESSAGE_PREFIX}${taskId}:`)}*`;
  return sql<{ readonly found: number }>`
    SELECT 1 AS found
    FROM orchestration_v2_projection_runs
    WHERE thread_id = ${threadId}
      AND status IN ${sql.in(UNFINISHED_RUN_STATUSES)}
      AND json_extract(payload_json, '$.userMessageId') GLOB ${pattern}
    LIMIT 1
  `.pipe(
    Effect.map((rows) => rows.length > 0),
    Effect.mapError(holdCheckError(taskId)),
  );
}

/** Whether the owner is in a chat with the bot: any run of the thread is unfinished, or the owner
    wrote within the window. A wake's message carries its task's `createdBy`, which is `user` for a
    task the owner made, so wakes are told apart by message id rather than author. */
function isInChat(
  sql: SqlClient.SqlClient,
  taskId: ScheduledTaskId,
  threadId: string,
  nowMs: number,
): Effect.Effect<boolean, ScheduledTaskError> {
  const since = DateTime.formatIso(DateTime.makeUnsafe(nowMs - FORK_BOT_CHAT_WINDOW_MS));
  const wakes = `${escapeGlobPrefix(SCHEDULED_TASK_MESSAGE_PREFIX)}*`;
  return sql<{ readonly found: number }>`
    SELECT 1 AS found
    WHERE EXISTS (
      SELECT 1 FROM orchestration_v2_projection_runs
      WHERE thread_id = ${threadId} AND status IN ${sql.in(UNFINISHED_RUN_STATUSES)}
    ) OR EXISTS (
      SELECT 1 FROM orchestration_v2_projection_messages
      WHERE thread_id = ${threadId}
        AND created_at > ${since}
        AND role = 'user'
        AND json_extract(payload_json, '$.createdBy') = 'user'
        AND message_id NOT GLOB ${wakes}
    )
  `.pipe(
    Effect.map((rows) => rows.length > 0),
    Effect.mapError(holdCheckError(taskId)),
  );
}

/** Whether a thread is usage-limited until a known reset still ahead. An unknown reset never
    holds, so a held thread always wakes again on its own. */
function isUsageLimitedUntilLater(
  shell: Pick<OrchestrationV2ThreadShell, "lastErrorClass" | "usageLimitResetAt"> | null,
  nowMs: number,
): boolean {
  if (shell?.lastErrorClass !== "usage_limit" || !shell.usageLimitResetAt) return false;
  const resetAt = Date.parse(shell.usageLimitResetAt);
  return Number.isFinite(resetAt) && resetAt > nowMs;
}

/** Whether this scheduled fire of `task` is held. Only a recurring task bound to a bot is: it
    skips while the bot still runs an earlier wake of it or is usage-limited, and defers while the
    owner is in a chat with the bot. Other bound tasks queue behind an earlier run as upstream's
    do. A one-time run has no later fire to make up for a skip. */
export const forkScheduledFireHold = Effect.fn("ScheduledTaskService.forkScheduledFireHold")(
  function* <E>(input: {
    readonly sql: SqlClient.SqlClient;
    readonly task: ScheduledTask;
    readonly nowMs: number;
    readonly getThreadShell: (
      threadId: NonNullable<ScheduledTask["threadId"]>,
    ) => Effect.Effect<
      Pick<OrchestrationV2ThreadShell, "tags" | "lastErrorClass" | "usageLimitResetAt"> | null,
      E
    >;
  }): Effect.fn.Return<ForkScheduledFireHold, ScheduledTaskError | E> {
    const { sql, task, nowMs } = input;
    const threadId = task.threadId;
    if (threadId === null || task.schedule.type === "once") return "run";
    const shell = yield* input.getThreadShell(threadId);
    if (!isForkBotThread(shell?.tags)) return "run";
    if (isUsageLimitedUntilLater(shell, nowMs)) return "skip";
    if (yield* hasUnfinishedScheduledRun(sql, task.id, threadId)) return "skip";
    return (yield* isInChat(sql, task.id, threadId, nowMs)) ? "defer" : "run";
  },
);

/** Moves a held fire a few minutes ahead instead of to its next regular slot. */
export const forkDeferScheduledFire = Effect.fn("ScheduledTaskService.forkDeferScheduledFire")(
  function* (sql: SqlClient.SqlClient, task: ScheduledTask, nowMs: number) {
    const deferredTo = DateTime.formatIso(DateTime.makeUnsafe(nowMs + FORK_BOT_CHAT_DEFER_MS));
    yield* Effect.logInfo("Deferring a bot's wake while its owner chats with it", {
      taskId: task.id,
      deferredTo,
    });
    yield* sql`
      UPDATE scheduled_tasks
      SET next_run_at = ${deferredTo},
          updated_at = ${DateTime.formatIso(DateTime.makeUnsafe(nowMs))}
      WHERE task_id = ${task.id}
    `.pipe(
      Effect.mapError(
        (cause) =>
          new ScheduledTaskError({
            message: "Could not defer the task's run.",
            taskId: task.id,
            cause,
          }),
      ),
    );
  },
);
