/**
 * A bot's work reports, read back from their notifications — see
 * `.fork/customizations.yaml#fork-thread-launch-cards`. Every reading of the server's report ids and
 * summaries (orchestration-v2/forkBotWorkReports) lives here, so a change there has one place to
 * follow.
 */
import type {
  ForkWorkRequestKind,
  OrchestrationV2NotificationSource,
  ScopedThreadRef,
  ThreadId,
} from "@t3tools/contracts";

import type { TimelineEntry } from "~/session-logic";

// The server's work-report message ids: the prefix, then the reporting thread's id and the run or
// request it reports on. A notification's turn item id is `turn-item:message:` and that message
// id, URI-encoded.
const NOTIFICATION_ITEM_PREFIX = "turn-item:message:";
const WORK_REPORT_PREFIXES = ["message:fork-bot-work-report:", "message:fork-bot-work-seen:"];

/** What follows a work report's prefix in its notification's item id, or null for another item. */
export function forkWorkReportKey(itemId: string): string | null {
  if (!itemId.startsWith(NOTIFICATION_ITEM_PREFIX)) return null;
  let messageId: string;
  try {
    messageId = decodeURIComponent(itemId.slice(NOTIFICATION_ITEM_PREFIX.length));
  } catch {
    return null;
  }
  const prefix = WORK_REPORT_PREFIXES.find((candidate) => messageId.startsWith(candidate));
  return prefix === undefined ? null : messageId.slice(prefix.length);
}

/** The thread a report key names. Thread ids can hold colons, so it is the longest of the
    candidates the key starts with, followed by a colon. */
export function forkWorkReportThreadId<Id extends string>(
  key: string,
  threadIds: Iterable<Id>,
): Id | null {
  const ids: ReadonlySet<string> = threadIds instanceof Set ? threadIds : new Set(threadIds);
  for (let at = key.lastIndexOf(":"); at > 0; at = key.lastIndexOf(":", at - 1)) {
    const candidate = key.slice(0, at);
    // One of the ids, so it is an Id.
    if (ids.has(candidate)) return candidate as Id;
  }
  return null;
}

const threadIdIndexes = new WeakMap<ReadonlyArray<ScopedThreadRef>, ReadonlySet<ThreadId>>();

/** One machine's thread ids, built once per list of its threads and shared by every report row. */
export function forkWorkReportThreadIds(
  refs: ReadonlyArray<ScopedThreadRef>,
): ReadonlySet<ThreadId> {
  let ids = threadIdIndexes.get(refs);
  if (ids === undefined) {
    ids = new Set(refs.map((ref) => ref.threadId));
    threadIdIndexes.set(refs, ids);
  }
  return ids;
}

/** A report about a thread waiting on its owner: the server's summary ends with what it waits on. */
export function forkWorkReportRequestKind(summary: string): "question" | "approval" | null {
  if (summary.endsWith(" has a question")) return "question";
  if (summary.endsWith(" needs an approval")) return "approval";
  return null;
}

/** The request a report key names is the one the thread still waits on. */
export function forkWorkReportIsPending(
  key: string,
  threadId: string,
  pendingRequestId: string | null | undefined,
): boolean {
  return pendingRequestId != null && key === `${threadId}:${pendingRequestId}`;
}

export interface ForkWorkReport {
  /** `threadId:requestId` for a question or approval, which ANSWERS.md and the pending check use. */
  readonly key: string;
  /** Null when only the key names it: resolve it with forkWorkReportThreadId. */
  readonly threadId: ThreadId | null;
  readonly requestKind: ForkWorkRequestKind | null;
}

/** A notification read as a work report: from the source's forkWorkReport when the server sent one
    (fork-bot-work-reports), else from its id and summary, for older servers and earlier reports. */
export function forkWorkReportOf(notice: {
  readonly id: string;
  readonly summary: string;
  readonly source: OrchestrationV2NotificationSource | undefined;
}): ForkWorkReport | null {
  const named = notice.source?.kind === "system" ? notice.source.forkWorkReport : undefined;
  if (named !== undefined) {
    const { threadId, request } = named;
    return {
      key:
        request === undefined
          ? (forkWorkReportKey(notice.id) ?? threadId)
          : `${threadId}:${request.id}`,
      threadId,
      requestKind: request?.kind ?? null,
    };
  }
  const key = forkWorkReportKey(notice.id);
  if (key === null) return null;
  return { key, threadId: null, requestKind: forkWorkReportRequestKind(notice.summary) };
}

/** A work report of a thread's question or approval, which carries the card the owner answers on. */
export function isForkWorkRequestReport(entry: TimelineEntry): boolean {
  if (entry.kind !== "work" || entry.entry.itemType !== "notification") return false;
  const item = entry.entry.projectedItem?.item;
  const report = forkWorkReportOf({
    id: entry.id,
    summary: entry.entry.label,
    source: item?.type === "notification" ? item.source : undefined,
  });
  return report?.requestKind != null;
}
