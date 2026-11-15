/**
 * A thread that finishes while you watch the sidebar: two rings pulse off its Done dot, and a
 * petal's mascot gives one small hop. See `.fork/customizations.yaml#fork-done-celebration`.
 */
import { type RefObject, useEffect } from "react";

import type { SidebarV2TopStatusMark } from "./SidebarV2StatusIndicator";

/** How long after a mark last showed Working a Done still counts as that thread finishing. */
const FRESH_MS = 1500;

type MarkKind = "working" | "done" | "other";

/**
 * Each thread's last mark, outliving the row that drew it: a finished thread moves out of the
 * Working group, so the row showing Done is often a fresh mount. Leaving a mark stamps it, so a
 * row unmounted long ago that comes back Done is stale and stays still.
 */
export function createDoneTransitions() {
  const seen = new Map<string, { readonly kind: MarkKind; readonly at: number }>();
  return {
    /** Whether `key` left Working just now, so a Done mark for it is that thread finishing. */
    leftWorking(key: string, now: number): boolean {
      const previous = seen.get(key);
      return previous?.kind === "working" && now - previous.at <= FRESH_MS;
    },
    enter(key: string, kind: MarkKind, now: number) {
      seen.set(key, { kind, at: now });
    },
    leave(key: string, kind: MarkKind, now: number) {
      if (seen.get(key)?.kind === kind) seen.set(key, { kind, at: now });
    },
  };
}

const transitions = createDoneTransitions();

/** Plays the celebration on `dot` when the mark keyed `threadKey` turns from Working to Done. */
export function useDoneCelebration(
  threadKey: string,
  status: SidebarV2TopStatusMark | null,
  dot: RefObject<HTMLElement | null>,
) {
  const kind: MarkKind =
    status?.mark === "working"
      ? "working"
      : status?.mark === "dot" && status.tone === "done"
        ? "done"
        : "other";
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- animates the DOM when the mark's status changes, keyed across remounts
  useEffect(() => {
    const element = dot.current;
    const now = performance.now();
    const finished = kind === "done" && transitions.leftWorking(threadKey, now);
    // A hidden copy (a collapsed tab while the sidebar is open) must not take the transition
    // from the copy on screen. Measured only once a transition is waiting.
    if (!finished || (element !== null && isOnScreen(element))) {
      transitions.enter(threadKey, kind, now);
      if (finished && element !== null) {
        const row = element.closest("[data-thread-item], [data-fork-thread-tab]");
        celebrateDone(element, row?.querySelector<SVGElement>("svg[data-fork-bot-mascot]") ?? null);
      }
    }
    return () => transitions.leave(threadKey, kind, performance.now());
  }, [threadKey, kind, dot]);
}

/** Drawn, and its centre inside every box that clips it: the rings sit on the page, above the clips. */
function isOnScreen(element: HTMLElement): boolean {
  if (!element.checkVisibility({ visibilityProperty: true })) return false;
  const box = element.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  for (let clip = element.parentElement; clip !== null; clip = clip.parentElement) {
    const style = getComputedStyle(clip);
    if (style.overflowX === "visible" && style.overflowY === "visible") continue;
    const bounds = clip.getBoundingClientRect();
    if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) return false;
  }
  return true;
}

/** The rings' look is in theme.custom.css ([data-fork-done-ring]). */
function celebrateDone(dot: HTMLElement, mascot: SVGElement | null) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // Two rings in the dot's own color, the second 320ms behind the first.
  const box = dot.getBoundingClientRect();
  const color = getComputedStyle(dot).backgroundColor;
  for (const [index, delay] of [0, 320].entries()) {
    const ring = document.createElement("div");
    ring.setAttribute("data-fork-done-ring", index === 0 ? "flash" : "");
    ring.style.setProperty("--fork-done-ring-color", color);
    Object.assign(ring.style, {
      left: `${box.left}px`,
      top: `${box.top + box.height / 2 - box.width / 2}px`,
      width: `${box.width}px`,
      height: `${box.width}px`,
    });
    document.documentElement.append(ring);
    ring.animate(
      [
        { transform: "scale(1)", opacity: 0.85 },
        { transform: "scale(4.6)", opacity: 0 },
      ],
      { duration: 1200, delay, easing: "cubic-bezier(.2,.7,.3,1)", fill: "both" },
    ).onfinish = () => ring.remove();
  }

  // The mascot: crouch, hop 3.5px, land with a soft squash, settle. Anchored at its feet.
  if (mascot === null) return;
  mascot.style.transformOrigin = "50% 100%";
  mascot.animate(
    [
      { transform: "translateY(0) scale(1, 1)" },
      { transform: "translateY(0) scale(1.06, .9)", offset: 0.14 },
      { transform: "translateY(-3.5px) scale(.96, 1.05)", offset: 0.42 },
      { transform: "translateY(0) scale(1.05, .93)", offset: 0.7 },
      { transform: "translateY(0) scale(1, 1)" },
    ],
    { duration: 560, easing: "ease-in-out" },
  );
}
