/**
 * Which way a dock switch travels, and the native stack options for it — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`. No React Native imports: the root stack and
 * tests read it.
 */
import type { No3yNavItemId } from "./mobileStatusGrouping";

const DOCK_ORDER: Partial<Record<No3yNavItemId, number>> = {
  threads: 0,
  newAgent: 1,
  chat: 2,
  automations: 3,
};

/** +1 moving right along the dock, -1 moving left, 0 when it is no move between dock items. */
export function no3yDockDirection(from: No3yNavItemId | null, to: No3yNavItemId): 1 | -1 | 0 {
  const start = from === null ? undefined : DOCK_ORDER[from];
  const end = DOCK_ORDER[to];
  if (start === undefined || end === undefined || start === end) return 0;
  return end > start ? 1 : -1;
}

/** How long a dock press counts as the cause of the navigation that follows it. */
const MOVE_WINDOW_MS = 500;

let pending: { readonly direction: 1 | -1; readonly at: number } | null = null;

export function recordNo3yDockMove(from: No3yNavItemId | null, to: No3yNavItemId): void {
  const direction = no3yDockDirection(from, to);
  pending = direction === 0 ? null : { direction, at: Date.now() };
}

export function pendingNo3yDockDirection(): 1 | -1 | null {
  if (pending === null || Date.now() - pending.at > MOVE_WINDOW_MS) return null;
  return pending.direction;
}

/** The root stack's options for a dock switch: no native push or pop, the screen eases in itself. */
export function no3yDockScreenOptions(): { readonly animation?: "none" } {
  return pendingNo3yDockDirection() === null ? {} : { animation: "none" };
}
