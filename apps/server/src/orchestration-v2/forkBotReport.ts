/**
 * A bot's latest report on its thread shell — see `.fork/customizations.yaml#fork-bots`.
 * Shells carry no message bodies; bot-tagged ones carry the head of their last settled run's
 * final reply, never a wake's progress replies.
 */
import {
  MessageId,
  type OrchestrationV2LatestVisibleMessageSummary,
  type OrchestrationV2ThreadProjection,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

/** Must match the web client's `BOT_THREAD_TAG` (custom/bots/botThreads). */
export const FORK_BOT_THREAD_TAG = "bot";
/** Enough for the card's first line and the quiet-reply check; the transcript has the rest. */
export const FORK_BOT_REPORT_CHARS = 280;
/** A run whose last reply is its report. Rolled-back runs never report. */
export const FORK_BOT_SETTLED_RUN_STATUSES = ["completed", "interrupted", "failed", "cancelled"];

const decodeReportRow = Schema.decodeUnknownEffect(
  Schema.fromJsonString(
    Schema.Struct({ id: Schema.String, text: Schema.String, updatedAt: Schema.String }),
  ),
);

/** The shell row's `fork_bot_report_json` column, null for every thread that is not a bot. */
export const forkBotReportFromRow = (json: string | null) =>
  json === null
    ? Effect.succeed(null)
    : decodeReportRow(json).pipe(
        Effect.map((row): OrchestrationV2LatestVisibleMessageSummary => ({
          id: MessageId.make(row.id),
          role: "assistant",
          text: row.text,
          updatedAt: DateTime.makeUnsafe(row.updatedAt),
        })),
        Effect.orElseSucceed(() => null),
      );

/** The same report from a full projection, for the shell built from one. */
export function forkBotReportFromProjection(
  projection: OrchestrationV2ThreadProjection,
): OrchestrationV2LatestVisibleMessageSummary | null {
  if (projection.thread.tags?.includes(FORK_BOT_THREAD_TAG) !== true) return null;
  const settledRunIds = new Set(
    projection.runs
      .filter((run) => FORK_BOT_SETTLED_RUN_STATUSES.includes(run.status))
      .map((run) => run.id),
  );
  const latest = projection.messages
    .filter(
      (message) =>
        message.role === "assistant" &&
        !message.streaming &&
        message.runId !== null &&
        settledRunIds.has(message.runId),
    )
    .toSorted(
      (left, right) =>
        DateTime.toEpochMillis(right.updatedAt) - DateTime.toEpochMillis(left.updatedAt) ||
        right.id.localeCompare(left.id),
    )[0];
  return latest === undefined
    ? null
    : {
        id: latest.id,
        role: "assistant",
        text: latest.text.slice(0, FORK_BOT_REPORT_CHARS),
        updatedAt: latest.updatedAt,
      };
}
