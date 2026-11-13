/**
 * When a thread-bound task's scheduled fire is held — see
 * `.fork/customizations.yaml#fork-scheduled-wake-hold`. A bound task queues each fire behind
 * whatever its thread is doing, so a thread held up for a day would otherwise collect a day of
 * wakes and run them back to back, and a usage-limited one would hit the limit every interval.
 */
import type {
  OrchestrationV2ThreadShell,
  ScheduledTask,
  ScheduledTaskId,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import type * as SqlClient from "effect/sql/SqlClient";
import { ScheduledTaskError } from "@t3tools/contracts";

import { escapeGlobPrefix } from "./forkScheduledTaskRuns.ts";

/** Must match the message ids ScheduledTaskService mints for each fire. */
const SCHEDULED_TASK_MESSAGE_PREFIX = "scheduled-task-message:";

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
      AND status IN ('preparing', 'queued', 'starting', 'running', 'waiting')
      AND json_extract(payload_json, '$.userMessageId') GLOB ${pattern}
    LIMIT 1
  `.pipe(
    Effect.map((rows) => rows.length > 0),
    Effect.mapError(
      (cause) =>
        new ScheduledTaskError({
          message: "Could not check the task's earlier runs.",
          taskId,
          cause,
        }),
    ),
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

/** Whether this scheduled fire of `task` is held: it is bound, recurring, and its thread still
    runs an earlier wake of it or is usage-limited. A one-time run has no later fire to make up
    for a skip, so it is never held. */
export function forkScheduledFireHeld<E>(input: {
  readonly sql: SqlClient.SqlClient;
  readonly task: ScheduledTask;
  readonly nowMs: number;
  readonly getThreadShell: (
    threadId: NonNullable<ScheduledTask["threadId"]>,
  ) => Effect.Effect<
    Pick<OrchestrationV2ThreadShell, "lastErrorClass" | "usageLimitResetAt"> | null,
    E
  >;
}): Effect.Effect<boolean, ScheduledTaskError | E> {
  const { task } = input;
  if (task.threadId === null || task.schedule.type === "once") return Effect.succeed(false);
  return Effect.all([
    hasUnfinishedScheduledRun(input.sql, task.id, task.threadId),
    input.getThreadShell(task.threadId),
  ]).pipe(
    Effect.map(([unfinished, shell]) => unfinished || isUsageLimitedUntilLater(shell, input.nowMs)),
  );
}
