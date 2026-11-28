/**
 * A bot's wakes that found nothing stay out of its conversation — see
 * `.fork/customizations.yaml#fork-bots`, and a coordinator's (`#fork-coordinator-threads`), by
 * the policy of its mode. Applied where the timeline picks the entries it shows, so rewind
 * targets, which read every entry, still count the hidden runs.
 */
import type { MessageId, RunId } from "@t3tools/contracts";
import { isForkBotQuietReply } from "@t3tools/shared/forkBotTags";

import type { TimelineEntry } from "~/session-logic";

import {
  forkWorkReportOfEntry,
  forkWorkReportThreadId,
  isForkDelegatedCompletionReport,
  isForkDelegatedQuestionReport,
  isForkWorkRequestReport,
} from "../forkWorkReports";

/** Whose quiet wakes a timeline hides: a bot's (a Petal or a sprint) or a coordinator's. */
export type QuietWakeMode = "bot" | "coordinator";

interface QuietWakePolicy {
  /** Only a run a thread's request report or a delegated child's notice started can hide. */
  readonly reportedRunsOnly: boolean;
  /** A delegated child's notice, which is no message entry, starts its run, so the reads before
      the quiet reply ("Worked for") go too. */
  readonly noticeStartsRun: boolean;
  /** A delegated child's question notice survives its hidden run: it draws the owner's card. */
  readonly keepsDelegatedQuestions: boolean;
}

const QUIET_WAKE_POLICIES: Readonly<Record<QuietWakeMode, QuietWakePolicy>> = {
  // Any quiet run, from its first message or the work report that woke it.
  bot: { reportedRunsOnly: false, noticeStartsRun: false, keepsDelegatedQuestions: false },
  // Only a child's question or completion wake (or a request report) ends on the quiet reply.
  coordinator: { reportedRunsOnly: true, noticeStartsRun: true, keepsDelegatedQuestions: true },
};

/** The run an entry belongs to, user messages and events included (unlike the fold helpers). */
function entryOwningRunId(entry: TimelineEntry): RunId | null {
  switch (entry.kind) {
    case "message":
      return entry.message.runId;
    case "proposed-plan":
      return entry.proposedPlan.runId;
    case "html-render":
    case "mcp-app":
    case "sent-message":
    case "fork-thread-launch":
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
    run, one with an owner message, question or approval, and a cited reply's run always show.
    A coordinator's only: a run a thread's request report or a delegated child's question or
    completion notice started, whose card or notice is the exchange. */
export function quietBotWakeRunIds(
  entries: ReadonlyArray<TimelineEntry>,
  mode: QuietWakeMode,
  input: {
    readonly unsettledRunId: RunId | null;
    readonly failedRunIds: ReadonlySet<RunId>;
    readonly revealedMessageId: MessageId | null | undefined;
  },
): ReadonlySet<RunId> {
  const { reportedRunsOnly } = QUIET_WAKE_POLICIES[mode];
  const finalReply = new Map<RunId, Extract<TimelineEntry, { kind: "message" }>>();
  const shown = new Set<RunId>();
  const reported = new Set<RunId>();
  for (const entry of entries) {
    const runId = entryOwningRunId(entry);
    if (runId === null) continue;
    if (asksOwner(entry)) shown.add(runId);
    if (
      reportedRunsOnly &&
      (isForkWorkRequestReport(entry) ||
        isForkDelegatedQuestionReport(entry) ||
        isForkDelegatedCompletionReport(entry))
    ) {
      reported.add(runId);
    }
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
    if (reportedRunsOnly && !reported.has(runId)) continue;
    // Paged-in history can lack attempts; then only the live run is unfinished.
    const finished = reply.attempt
      ? reply.attempt.status === "completed"
      : runId !== input.unsettledRunId;
    if (finished && isForkBotQuietReply(reply.message.text)) quiet.add(runId);
  }
  return quiet;
}

/** A thread's last finished report, when that thread has no launch row here, keeps a quiet wake's
    notice as the thread's one row; its earlier quiet wakes go whole. Keyed by report id. */
function lastReportRows(entries: ReadonlyArray<TimelineEntry>): ReadonlySet<string> {
  const launched = new Set<string>();
  const lastByThread = new Map<string, string>();
  for (const entry of entries) {
    if (entry.kind === "fork-thread-launch" && entry.launch.threadId !== null) {
      launched.add(entry.launch.threadId);
    }
    const report = forkWorkReportOfEntry(entry);
    if (report === null || report.requestKind !== null) continue;
    // An older server names the thread only in the key, so each of its reports keeps its row.
    const threadId = report.threadId ?? forkWorkReportThreadId(report.key, launched);
    lastByThread.set(threadId ?? report.key, entry.id);
  }
  for (const threadId of launched) lastByThread.delete(threadId);
  return new Set(lastByThread.values());
}

/** Drops each run from its start: its first message, the report that woke it, or a coordinator's
    delegated notice. A resumed subagent card listed earlier keeps its turn. With
    `keepRequestReports` (a host answers inline) a question or approval report stays, as does a
    coordinator's delegated question: each carries a card. */
export function withoutRuns(
  entries: ReadonlyArray<TimelineEntry>,
  runIds: ReadonlySet<RunId>,
  mode: QuietWakeMode,
  keepRequestReports = false,
): ReadonlyArray<TimelineEntry> {
  if (runIds.size === 0) return entries;
  const { noticeStartsRun, keepsDelegatedQuestions } = QUIET_WAKE_POLICIES[mode];
  const startIndex = new Map<RunId, number>();
  entries.forEach((entry, index) => {
    const runId =
      entry.kind === "message"
        ? entry.message.runId
        : forkWorkReportOfEntry(entry) !== null ||
            (noticeStartsRun &&
              (isForkDelegatedQuestionReport(entry) || isForkDelegatedCompletionReport(entry)))
          ? entryOwningRunId(entry)
          : null;
    if (runId !== null && runIds.has(runId) && !startIndex.has(runId)) {
      startIndex.set(runId, index);
    }
  });
  const reportRows = lastReportRows(entries);
  return entries.filter((entry, index) => {
    const runId = entryOwningRunId(entry);
    const start = runId === null ? undefined : startIndex.get(runId);
    return (
      start === undefined ||
      index < start ||
      (index === start && reportRows.has(entry.id)) ||
      (keepRequestReports && isForkWorkRequestReport(entry)) ||
      (keepsDelegatedQuestions && isForkDelegatedQuestionReport(entry))
    );
  });
}
