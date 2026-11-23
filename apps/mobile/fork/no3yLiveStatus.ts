/**
 * The no3y transcript's live status line, ported from the Mac's fork-working-row-last — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`. The feed's derivation is untouched: its one
 * live row (thinking, or the running tool) moves to the end so an open group sits above it.
 */

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

const withoutLiveFold = new WeakMap<object, unknown>();

/** Drops upstream's live "Working for …" fold row; the status line already carries the timer. */
export function no3yDropLiveFold<
  Row extends { readonly type: string; readonly workingSince?: string },
>(rows: Row[]): Row[] {
  const isLiveFold = (row: Row) => row.type === "run-fold" && row.workingSince !== undefined;
  if (!rows.some(isLiveFold)) return rows;
  const cached = withoutLiveFold.get(rows) as Row[] | undefined;
  if (cached) return cached;
  const next = rows.filter((row) => !isLiveFold(row));
  withoutLiveFold.set(rows, next);
  return next;
}

type No3yLiveRow = {
  readonly id: string;
  readonly type: string;
  readonly groupId?: string;
  readonly activities?: ReadonlyArray<{ readonly groupStandIn?: { readonly groupId: string } }>;
};
const splitLiveTool = new WeakMap<object, { startedAt: string; rows: unknown }>();

/**
 * Upstream folds a running tool into the single live row. no3y keeps the tool in the transcript,
 * under the live work id upstream gives a running group, and puts a Thinking line with the turn
 * timer below it.
 */
export function no3ySplitLiveTool<Row extends No3yLiveRow>(
  rows: Row[],
  startedAt: string | null,
  thinking: (startedAt: string, tool: Row) => Row,
): Row[] {
  const index = rows.findIndex((row) => row.id === NO3Y_LIVE_ROW_ID);
  const live = rows[index];
  if (startedAt === null || live === undefined || live.type === "thinking") return rows;
  const groupId = live.groupId ?? live.activities?.[0]?.groupStandIn?.groupId;
  if (groupId === undefined) return rows;
  const cached = splitLiveTool.get(rows);
  if (cached?.startedAt === startedAt) return cached.rows as Row[];
  const next = [
    ...rows.slice(0, index),
    { ...live, id: `work-live:${groupId}` },
    ...rows.slice(index + 1),
    thinking(startedAt, live),
  ];
  splitLiveTool.set(rows, { startedAt, rows: next });
  return next;
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
