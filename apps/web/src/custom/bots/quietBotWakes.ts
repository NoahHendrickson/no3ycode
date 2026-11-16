/**
 * A bot's wakes that found nothing stay out of its conversation — see
 * `.fork/customizations.yaml#fork-bots`. Applied where the timeline picks the entries it shows,
 * so rewind targets, which read every entry, still count the hidden runs.
 */
import type { MessageId, RunId } from "@t3tools/contracts";
import { isForkBotQuietReply } from "@t3tools/shared/forkBotTags";

import type { TimelineEntry } from "~/session-logic";

/** The run an entry belongs to, user messages and events included (unlike the fold helpers). */
function entryOwningRunId(entry: TimelineEntry): RunId | null {
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

/** The owner answered or approved something in the run; the answer folds into this entry. */
function asksOwner(entry: TimelineEntry): boolean {
  const type =
    entry.kind === "work"
      ? entry.entry.itemType
      : entry.kind === "event"
        ? entry.projectedItem.item.type
        : undefined;
  return type === "user_input_request" || type === "approval_request";
}

/** Runs the owner never touched whose attempt completed on the quiet reply. A running or failed
    run, one with an owner message, question or approval, and a cited reply's run always show. */
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
    const runId = entryOwningRunId(entry);
    if (runId === null) continue;
    if (asksOwner(entry)) shown.add(runId);
    if (entry.kind !== "message") continue;
    const { message } = entry;
    if (message.id === input.revealedMessageId) shown.add(runId);
    if (message.role === "assistant") finalReply.set(runId, entry);
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
    if (shown.has(runId) || input.failedRunIds.has(runId)) continue;
    // Paged-in history can lack attempts; then only the live run is unfinished.
    const finished = reply.attempt
      ? reply.attempt.status === "completed"
      : runId !== input.unsettledRunId;
    if (finished && isForkBotQuietReply(reply.message.text)) quiet.add(runId);
  }
  return quiet;
}

/** Drops each run from its first message on. A resumed subagent card listed before that keeps
    its place in the earlier turn, as the turn folds place it. */
export function withoutRuns(
  entries: ReadonlyArray<TimelineEntry>,
  runIds: ReadonlySet<RunId>,
): ReadonlyArray<TimelineEntry> {
  if (runIds.size === 0) return entries;
  const startIndex = new Map<RunId, number>();
  entries.forEach((entry, index) => {
    const runId = entry.kind === "message" ? entry.message.runId : null;
    if (runId !== null && runIds.has(runId) && !startIndex.has(runId)) {
      startIndex.set(runId, index);
    }
  });
  return entries.filter((entry, index) => {
    const runId = entryOwningRunId(entry);
    const start = runId === null ? undefined : startIndex.get(runId);
    return start === undefined || index < start;
  });
}
