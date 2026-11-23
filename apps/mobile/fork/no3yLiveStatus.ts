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
