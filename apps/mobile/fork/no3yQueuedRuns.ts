/**
 * The no3y queued-messages banner's rules — see `.fork/customizations.yaml#fork-queued-runs-banner`.
 * Ported from the Mac fork's apps/web/src/custom/ForkQueuedRunsBanner.tsx, not imported.
 */
import { resolveUserMessagePresentation } from "@t3tools/client-runtime/user-message";

const SENDER_LABEL = { agent: "Agent", automation: "Automation", t3code: "T3 Code" } as const;

/** Who queued it, when it was not the owner typing: the guest's name, or the agent or automation. */
export function no3yQueuedSender(
  message: Parameters<typeof resolveUserMessagePresentation>[0] | undefined,
): { readonly label: string; readonly guest: boolean } | null {
  if (!message) return null;
  const presentation = resolveUserMessagePresentation(message);
  if (presentation.attribution === "guest" && presentation.guestName !== undefined) {
    return { label: presentation.guestName, guest: true };
  }
  if (presentation.attribution === null || presentation.attribution === "guest") return null;
  return { label: SENDER_LABEL[presentation.attribution], guest: false };
}

/** The queued-run.reorder input and the resulting order for dropping row `from` into slot `to`. */
export function no3yQueueDrop<RunId extends string>(
  runIds: ReadonlyArray<RunId>,
  from: number,
  to: number,
): {
  readonly move: { readonly runId: RunId; readonly beforeRunId: RunId | null };
  readonly order: ReadonlyArray<RunId>;
} | null {
  const runId = runIds[from];
  if (runId === undefined || to === from || to < 0 || to >= runIds.length) return null;
  const order = runIds.filter((id) => id !== runId);
  order.splice(to, 0, runId);
  return { move: { runId, beforeRunId: order[to + 1] ?? null }, order };
}

/** The slot a row dragged from `from` lands in after moving `translationY`. */
export function no3yQueueDropIndex(
  from: number,
  translationY: number,
  rowHeight: number,
  count: number,
): number {
  "worklet";
  if (rowHeight <= 0) return from;
  return Math.min(count - 1, Math.max(0, from + Math.round(translationY / rowHeight)));
}

/** How far a resting row steps aside while the row at `from` is held over slot `to`. */
export function no3yQueueRowShift(
  index: number,
  from: number,
  to: number,
  rowHeight: number,
): number {
  "worklet";
  if (from < 0 || index === from) return 0;
  if (from < to && index > from && index <= to) return -rowHeight;
  if (to < from && index >= to && index < from) return rowHeight;
  return 0;
}

/**
 * The rows in a dropped order, until the server's order moves off the one it replaced; null when
 * there is no drop to show. The reorder command resolves on the server's receipt, which can land
 * before the new order does.
 */
export function no3yQueueShownRuns<T, RunId extends string>(
  rows: ReadonlyArray<T>,
  idOf: (row: T) => RunId,
  pending: { readonly order: ReadonlyArray<RunId>; readonly base: ReadonlyArray<RunId> } | null,
): ReadonlyArray<T> | null {
  if (pending === null) return null;
  const unchanged =
    rows.length === pending.base.length &&
    rows.every((row, index) => idOf(row) === pending.base[index]);
  if (!unchanged) return null;
  const rank = new Map(pending.order.map((id, index) => [id, index]));
  return [...rows].sort((left, right) => rank.get(idOf(left))! - rank.get(idOf(right))!);
}

/**
 * The scroll offset for this frame while a lifted row's top sits at `rowTop` in the list's
 * viewport: it eases toward whichever edge the row presses into, faster the deeper it goes.
 */
export function no3yQueueAutoScroll(
  rowTop: number,
  rowHeight: number,
  viewport: number,
  scroll: number,
  contentHeight: number,
): number {
  "worklet";
  const maxScroll = contentHeight - viewport;
  if (viewport <= 0 || maxScroll <= 0) return scroll;
  const zone = rowHeight / 2;
  const maxStep = 8;
  const above = zone - rowTop;
  const below = rowTop + rowHeight - (viewport - zone);
  const step =
    above > 0
      ? -Math.min(maxStep, (maxStep * above) / zone)
      : below > 0
        ? Math.min(maxStep, (maxStep * below) / zone)
        : 0;
  return Math.min(maxScroll, Math.max(0, scroll + step));
}
