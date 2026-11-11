/** Inlet hangs a tab's thread menu from its "…" button, in the page, so it joins the button as the
    strip's other menus do; a native menu cannot. The sidebar's handler builds that menu and awaits
    its own reads first, so the button rides to localApi's show call here, briefly. */
import { isInletActive } from "./forkActivePalette";

let pending: { readonly anchor: HTMLElement; readonly at: number } | null = null;

export function anchorNextContextMenu(anchor: HTMLElement) {
  pending = { anchor, at: performance.now() };
}

export function takeContextMenuAnchor(): HTMLElement | null {
  const next = pending;
  pending = null;
  if (next === null || !next.anchor.isConnected || performance.now() - next.at > 1000) return null;
  return isInletActive() ? next.anchor : null;
}
