/**
 * Sidebar V2 list motion — see `.fork/customizations.yaml#sidebar-v2-list-animation`.
 *
 * The thread list animates whenever its rows are added, removed or reordered:
 * an entering row grows in from 98% as it fades in, a leaving row shrinks to
 * 98% as it fades out where it stood, and the rows around them slide to their
 * new places (FLIP). Add is the exact reverse of remove, so expanding a
 * project group feels like collapsing it played backwards.
 *
 * This replaces `@formkit/auto-animate`, which drew the same keyframes but
 * polled every row's position on a 2s timer and rebuilt an
 * IntersectionObserver per row as it did, for as long as the list was
 * mounted, and never stopped for rows that had left. Here positions are
 * layout offsets inside the list, read when its rows change (and kept fresh
 * as rows resize), so nothing runs while the list is still. A row
 * whose own size changes takes the new size at once; the rows below it slide.
 */
import { observeResize } from "~/lib/observeResize";

export const SIDEBAR_V2_LIST_ANIMATION_DURATION_MS = 150;
export const SIDEBAR_V2_LIST_ANIMATION_EASING = "ease-out";

/** Collapse / remove. */
export const SIDEBAR_V2_LIST_REMOVE_KEYFRAMES = [
  { transform: "scale(1)", opacity: 1 },
  { transform: "scale(.98)", opacity: 0 },
] as const;

/** Expand / add — exact reverse of remove. */
export const SIDEBAR_V2_LIST_ADD_KEYFRAMES = [
  { transform: "scale(.98)", opacity: 0 },
  { transform: "scale(1)", opacity: 1 },
] as const;

type MatchMedia = (query: string) => { readonly matches: boolean };

/** Exported for tests. */
export function sidebarV2ListAnimationDurationMs(
  matchMedia: MatchMedia | undefined = globalThis.matchMedia,
): number {
  if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return 0;
  }
  return SIDEBAR_V2_LIST_ANIMATION_DURATION_MS;
}

interface RowBox {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

/** Attributes a leaving row's stand-in drops, so lookups and tests never find it. */
const CLONE_DROPPED_ATTRIBUTES = ["data-thread-item", "data-thread-selection-safe", "data-testid"];

/** Starts the list's motion; returns its cleanup. */
export function attachSidebarV2ListMotion(list: HTMLElement): () => void {
  if (typeof MutationObserver === "undefined") return () => {};
  // Leaving rows' stand-ins are positioned against the list.
  if (getComputedStyle(list).position === "static") list.style.position = "relative";

  const clones = new Set<HTMLElement>();
  const moving = new Map<HTMLElement, { readonly animation: Animation; readonly offset: number }>();
  const rows = () =>
    Array.from(list.children).filter(
      (node): node is HTMLElement => node instanceof HTMLElement && !clones.has(node),
    );
  const measure = () =>
    new Map<HTMLElement, RowBox>(
      rows().map((row) => [
        row,
        {
          top: row.offsetTop,
          left: row.offsetLeft,
          width: row.offsetWidth,
          height: row.offsetHeight,
        },
      ]),
    );
  // How far a row still is from its place in a slide that has not finished.
  const remainingOffset = (row: HTMLElement) => {
    const slide = moving.get(row);
    if (!slide) return 0;
    const progress =
      slide.animation.playState === "finished"
        ? 1
        : (slide.animation.effect?.getComputedTiming().progress ?? 0);
    return slide.offset * (1 - progress);
  };

  let boxes = measure();
  // A row that changes size without the list changing moves the rows below it.
  const sized = new Map<HTMLElement, () => void>();
  const watchSize = (row: HTMLElement) =>
    sized.set(
      row,
      observeResize(row, () => {
        boxes = measure();
      }),
    );
  for (const row of boxes.keys()) watchSize(row);

  const fadeOut = (row: HTMLElement, box: RowBox, timing: KeyframeAnimationOptions) => {
    const clone = row.cloneNode(true) as HTMLElement;
    for (const element of [clone, ...clone.querySelectorAll("*")]) {
      if (element.namespaceURI !== "http://www.w3.org/2000/svg") element.removeAttribute("id");
      for (const name of CLONE_DROPPED_ATTRIBUTES) element.removeAttribute(name);
    }
    clone.setAttribute("aria-hidden", "true");
    clone.inert = true;
    Object.assign(clone.style, {
      position: "absolute",
      top: `${box.top + remainingOffset(row)}px`,
      left: `${box.left}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
      margin: "0",
      boxSizing: "border-box",
      contentVisibility: "visible",
      transform: "none",
      transition: "none",
      pointerEvents: "none",
    });
    clones.add(clone);
    list.append(clone);
    const animation = clone.animate([...SIDEBAR_V2_LIST_REMOVE_KEYFRAMES], timing);
    const drop = () => {
      clone.remove();
      clones.delete(clone);
    };
    animation.addEventListener("finish", drop, { once: true });
    animation.addEventListener("cancel", drop, { once: true });
  };

  const slide = (row: HTMLElement, from: RowBox, to: RowBox, timing: KeyframeAnimationOptions) => {
    // A row whose bottom (or right) edge stayed put only changed size: it does not travel.
    const deltaLeft = from.left + from.width === to.left + to.width ? 0 : from.left - to.left;
    const deltaTop =
      (from.top + from.height === to.top + to.height ? 0 : from.top - to.top) +
      remainingOffset(row);
    if (deltaLeft === 0 && deltaTop === 0) return;
    moving.get(row)?.animation.cancel();
    const animation = row.animate(
      [{ transform: `translate(${deltaLeft}px, ${deltaTop}px)` }, { transform: "translate(0, 0)" }],
      timing,
    );
    moving.set(row, { animation, offset: deltaTop });
    animation.addEventListener(
      "finish",
      () => {
        if (moving.get(row)?.animation === animation) moving.delete(row);
      },
      { once: true },
    );
  };

  const changes = new MutationObserver((records) => {
    // Only the list's own rows count; a stand-in coming or going changes nothing.
    const rowsChanged = records.some((record) =>
      [...record.addedNodes, ...record.removedNodes].some(
        (node) => node instanceof HTMLElement && !clones.has(node),
      ),
    );
    if (!rowsChanged) return;
    const previous = boxes;
    boxes = measure();
    for (const row of previous.keys()) {
      if (boxes.has(row)) continue;
      sized.get(row)?.();
      sized.delete(row);
    }
    for (const row of boxes.keys()) if (!previous.has(row)) watchSize(row);
    const duration = sidebarV2ListAnimationDurationMs();
    // A hidden list (the closed mobile sheet) reports zero boxes; it only keeps them.
    if (duration === 0 || list.getClientRects().length === 0) return;
    const timing = { duration, easing: SIDEBAR_V2_LIST_ANIMATION_EASING };
    for (const [row, box] of previous) {
      if (!boxes.has(row) && box.height > 0) fadeOut(row, box, timing);
    }
    for (const [row, box] of boxes) {
      const before = previous.get(row);
      if (before) slide(row, before, box, timing);
      else if (box.height > 0) row.animate([...SIDEBAR_V2_LIST_ADD_KEYFRAMES], timing);
    }
    for (const row of moving.keys()) if (!boxes.has(row)) moving.delete(row);
  });
  changes.observe(list, { childList: true });

  return () => {
    changes.disconnect();
    for (const unobserve of sized.values()) unobserve();
    sized.clear();
    for (const { animation } of moving.values()) animation.cancel();
    moving.clear();
    for (const clone of clones) clone.remove();
    clones.clear();
  };
}
