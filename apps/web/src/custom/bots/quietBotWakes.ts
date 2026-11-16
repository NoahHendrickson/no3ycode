/**
 * A bot's wakes that found nothing stay out of its conversation — see
 * `.fork/customizations.yaml#fork-bots`. Applied where the timeline picks the entries it shows,
 * so rewind targets, which read every entry, still count the hidden runs.
 */
import type { MessageId, RunId } from "@t3tools/contracts";
import { isForkBotQuietReply } from "@t3tools/shared/forkBotTags";

import type { TimelineEntry } from "~/session-logic";

function entryRunId(entry: TimelineEntry): RunId | null {
  switch (entry.kind) {
    case "message":
      return entry.message.runId;
    case "proposed-plan":
      return entry.proposedPlan.runId;
    case "html-render":
    case "mcp-app":
      return entry.runId;
    case "work":
      return entry.entry.runId ?? null;
    case "event":
      return entry.projectedItem.item.runId;
  }
}

/** Finished runs the owner did not start whose final reply is the quiet one. A run the owner
    typed into, a failed or unfinished one, and the run of a cited reply always show. */
export function quietBotWakeRunIds(
  entries: ReadonlyArray<TimelineEntry>,
  input: {
    readonly unsettledRunId: RunId | null;
    readonly failedRunIds: ReadonlySet<RunId>;
    readonly revealedMessageId: MessageId | null | undefined;
  },
): ReadonlySet<RunId> {
  const finalReply = new Map<RunId, Extract<TimelineEntry, { kind: "message" }>>();
  const shown = new Set<RunId>();
  for (const entry of entries) {
    if (entry.kind !== "message") continue;
    const runId = entryRunId(entry);
    if (runId === null) continue;
    const { message } = entry;
    if (message.id === input.revealedMessageId) shown.add(runId);
    if (message.role === "assistant") finalReply.set(runId, entry);
    // An optimistic send has no creator yet; it is the owner's.
    if (
      message.role === "user" &&
      (message.createdBy ?? "user") === "user" &&
      message.scheduledTaskId === undefined
    ) {
      shown.add(runId);
    }
  }
  const quiet = new Set<RunId>();
  for (const [runId, reply] of finalReply) {
    if (shown.has(runId) || runId === input.unsettledRunId || input.failedRunIds.has(runId)) {
      continue;
    }
    if (reply.message.streaming || (reply.attempt && reply.attempt.status !== "completed")) {
      continue;
    }
    if (isForkBotQuietReply(reply.message.text)) quiet.add(runId);
  }
  return quiet;
}

export function withoutRuns(
  entries: ReadonlyArray<TimelineEntry>,
  runIds: ReadonlySet<RunId>,
): ReadonlyArray<TimelineEntry> {
  if (runIds.size === 0) return entries;
  return entries.filter((entry) => {
    const runId = entryRunId(entry);
    return runId === null || !runIds.has(runId);
  });
}
