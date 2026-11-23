/**
 * The no3y transcript's live status line, ported from the Mac's fork-working-row-last — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`. The feed's derivation is untouched: its one
 * live row (thinking, or the running tool) moves to the end so an open group sits above it.
 */

import type {
  PendingFoldFeedEntry,
  PendingThreadFeedEntry,
} from "../src/features/threads/pending-thread-feed";

/** The id upstream's feed derivation gives its single live row (threadActivity's LIVE_ACTIVITY_ROW_ID). */
export const NO3Y_LIVE_ROW_ID = "live-activity-row";

// Keyed by the derived rows, which the feed cache returns unchanged until they change.
const reordered = new WeakMap<object, unknown>();

export function no3yLiveRowLast<Row extends { readonly id: string }>(rows: Row[]): Row[] {
  const index = rows.findIndex((row) => row.id === NO3Y_LIVE_ROW_ID);
  if (index < 0 || index === rows.length - 1) return rows;
  const cached = reordered.get(rows) as Row[] | undefined;
  if (cached) return cached;
  const next = [...rows.slice(0, index), ...rows.slice(index + 1), rows[index]!];
  reordered.set(rows, next);
  return next;
}

type LiveRows = ReadonlyArray<PendingThreadFeedEntry | PendingFoldFeedEntry>;
type ThinkingRow = Extract<PendingThreadFeedEntry, { readonly type: "thinking" }>;
type WorkRow = Extract<PendingThreadFeedEntry, { readonly type: "work-toggle" | "activity-group" }>;
const presented = new WeakMap<object, { key: string; rows: LiveRows }>();

/**
 * The no3y live turn: the status line owns the timer, so the live fold (kept only to host the setup
 * chip) and the pending placeholder drop; a running tool stays a row with Thinking below it. Runs
 * after the pending-turn appender, which reads the live fold to know a run is under way.
 */
export function no3yLivePresentation(
  rows: LiveRows,
  input: { readonly startedAt: string | null; readonly keepLiveFold: boolean },
): LiveRows {
  const key = `${input.startedAt}|${input.keepLiveFold}`;
  const cached = presented.get(rows);
  if (cached?.key === key) return cached.rows;
  const next: Array<PendingThreadFeedEntry | PendingFoldFeedEntry> = [];
  for (const row of rows) {
    if (row.type === "pending-fold") continue;
    if (row.type === "run-fold" && row.workingSince !== undefined && !input.keepLiveFold) continue;
    if (row.id !== NO3Y_LIVE_ROW_ID || input.startedAt === null) {
      next.push(row);
      continue;
    }
    const tool = liveToolRow(row);
    if (tool === null) {
      next.push(row);
      continue;
    }
    const thinking: ThinkingRow = {
      type: "thinking",
      id: NO3Y_LIVE_ROW_ID,
      createdAt: input.startedAt,
      runId: tool.runId,
    };
    next.push(tool, thinking);
  }
  const result =
    next.length === rows.length && next.every((row, i) => row === rows[i]) ? rows : next;
  presented.set(rows, { key, rows: result });
  return result;
}

/** The live row as an ordinary transcript row, or null when it stays the status line. */
function liveToolRow(row: PendingThreadFeedEntry): WorkRow | null {
  if (row.type === "work-toggle") {
    if (row.summaryKind === "reasoning") return null;
    // Upstream shimmers a finished tail too; below the split, only the status line animates.
    return { ...row, id: `work-live:${row.groupId}`, shimmer: false };
  }
  if (row.type === "activity-group") {
    const groupId = row.activities[0]?.groupStandIn?.groupId;
    if (groupId === undefined) return null;
    return {
      ...row,
      id: `work-live:${groupId}`,
      activities: row.activities.map((activity) => ({
        ...activity,
        live: activity.live && activity.lifecycleStatus === "inProgress",
      })),
    };
  }
  return null;
}

/** The turn's timer: "42s", "3m 05s", "1h 02m". */
export function no3yTurnTimerLabel(startedAt: string, nowMs: number): string {
  const startedAtMs = Date.parse(startedAt);
  const total =
    Number.isFinite(startedAtMs) && nowMs > startedAtMs
      ? Math.floor((nowMs - startedAtMs) / 1_000)
      : 0;
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes}m ${String(total % 60).padStart(2, "0")}s`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}
