/**
 * A bot's latest report on its thread shell — see `.fork/customizations.yaml#fork-bots`.
 * Shells carry no message bodies; a bot-tagged one carries the head of the final reply of its
 * latest settled run that found something, so clients read unread state off the server alone.
 */
import {
  MessageId,
  type OrchestrationV2LatestVisibleMessageSummary,
  type OrchestrationV2RunStatus,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

/** Must match the web client's `BOT_THREAD_TAG` (custom/bots/botThreads). */
export const FORK_BOT_THREAD_TAG = "bot";
/** Enough for the card's first line; the transcript has the rest. */
export const FORK_BOT_REPORT_CHARS = 280;
/** How many of a bot's newest replies the report is looked for in: some hundreds of wakes. A
    report older than that has gone stale, and the bound keeps each shell read constant. */
export const FORK_BOT_REPORT_LOOKBACK = 1000;
/** A run whose final reply can be a report. Rolled-back runs never report. */
export const FORK_BOT_SETTLED_RUN_STATUSES: ReadonlyArray<OrchestrationV2RunStatus> = [
  "completed",
  "interrupted",
  "failed",
  "cancelled",
];
/** A wake that found nothing ends on this reply (the client seeds it as `BOT_QUIET_REPLY`).
    Lowercased and trimmed, with and without its full stop, for the shell query to compare. */
export const FORK_BOT_QUIET_REPLIES = ["nothing to report", "nothing to report."];

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
