/** Inlet hangs a tab's thread menu from its "…" button, in the page, so it joins the button as the
    strip's other menus do; a native menu cannot. The sidebar's handler hands the position it was
    given to localApi's show call unchanged, so the button rides on that object. */
import { isInletActive } from "./forkActivePalette";

const anchors = new WeakMap<object, HTMLElement>();

/** The menu position 4px below the button, start-aligned, that remembers the button. */
export function anchoredMenuPosition(anchor: HTMLElement): { x: number; y: number } {
  const box = anchor.getBoundingClientRect();
  const position = { x: box.left, y: box.bottom + 4 };
  anchors.set(position, anchor);
  return position;
}

/** The button a show call's position hangs from, on Inlet only. */
export function contextMenuAnchorFor(position: object | undefined): HTMLElement | null {
  const anchor = position === undefined ? undefined : anchors.get(position);
  return anchor?.isConnected && isInletActive() ? anchor : null;
}
