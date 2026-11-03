/**
 * Collapsed-sidebar peek — see `.fork/customizations.yaml#fork-sidebar-peek`.
 * Module state: the trigger and the panel are siblings under the provider.
 * "dismissed" drops the slide transition so the card vanishes instead.
 */

import { useEffect, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";

import { isContextMenuOpen } from "../contextMenuFallback";

type SidebarPeekState = "off" | "open" | "dismissed";

const OPEN_DELAY_MS = 80;
const CLOSE_DELAY_MS = 200;
const PANEL_SELECTOR = '[data-app-sidebar][data-slot="sidebar-container"]';
const TRIGGER_SELECTOR = "[data-sidebar-peek-trigger]";

let state: SidebarPeekState = "off";
let openTimer: ReturnType<typeof setTimeout> | undefined;
// A collapse can mount the trigger under the pointer, so hover only counts once
// the pointer has been seen off it.
let armed = false;
const listeners = new Set<() => void>();

function setState(next: SidebarPeekState) {
  if (state === next) return;
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function cancelOpen() {
  clearTimeout(openTimer);
  openTimer = undefined;
}

function dismiss() {
  cancelOpen();
  if (state === "open") setState("dismissed");
}

export function useSidebarPeekState(): SidebarPeekState {
  return useSyncExternalStore(subscribe, () => state);
}

function isOverCard(target: EventTarget | null): boolean {
  return (
    target instanceof Element && target.closest(`${PANEL_SELECTOR}, ${TRIGGER_SELECTOR}`) !== null
  );
}

// Menus the card opens render outside it: portaled popups, and the web build's
// DOM thread context menu. Tooltip triggers carry data-popup-open but no
// aria-haspopup. Native Electron menus capture input while open.
function cardMenuOpen(): boolean {
  return (
    isContextMenuOpen() ||
    document.querySelector(`${PANEL_SELECTOR} [data-popup-open][aria-haspopup]`) !== null
  );
}

const triggerProps = {
  "data-sidebar-peek-trigger": "",
  onPointerEnter: (event: ReactPointerEvent) => {
    if (event.pointerType === "touch" || !armed) return;
    cancelOpen();
    openTimer = setTimeout(() => setState("open"), OPEN_DELAY_MS);
  },
  onPointerLeave: cancelOpen,
};

/**
 * Hover props for the collapsed sidebar's floating toggle. The card closes when
 * the pointer leaves it and its menus, on Escape, on navigation, and when the
 * sidebar opens for real (`enabled` goes false).
 */
export function useSidebarPeekTrigger({
  enabled,
  pathname,
}: {
  enabled: boolean;
  pathname: string;
}) {
  const peek = useSidebarPeekState();

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- resets the module store on every open/collapse; arms on the first pointer move off the trigger
  useEffect(() => {
    cancelOpen();
    setState("off");
    if (!enabled) return;
    armed = false;
    const arm = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest(TRIGGER_SELECTOR)) return;
      armed = true;
      document.removeEventListener("pointermove", arm);
    };
    document.addEventListener("pointermove", arm, { passive: true });
    return () => document.removeEventListener("pointermove", arm);
  }, [enabled]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync, react/exhaustive-effect-dependencies -- the cleanup runs on each route change: picking a thread closes the card
  useEffect(() => dismiss, [pathname]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- document pointer and key listeners live only while the card is open
  useEffect(() => {
    if (peek !== "open") return;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    let pointer: { x: number; y: number } | null = null;
    // Re-reads the pointer when the grace ends: a menu closing under a still
    // pointer fires no event, so this keeps checking while one is open.
    function settle() {
      closeTimer = undefined;
      if (pointer && isOverCard(document.elementFromPoint(pointer.x, pointer.y))) return;
      if (cardMenuOpen()) scheduleClose();
      else dismiss();
    }
    function scheduleClose() {
      if (closeTimer === undefined) closeTimer = setTimeout(settle, CLOSE_DELAY_MS);
    }
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      pointer = { x: event.clientX, y: event.clientY };
      if (!isOverCard(event.target)) {
        scheduleClose();
        return;
      }
      clearTimeout(closeTimer);
      closeTimer = undefined;
    };
    // relatedTarget is null when the pointer leaves the window.
    const onPointerOut = (event: PointerEvent) => {
      if (event.relatedTarget !== null) return;
      pointer = null;
      scheduleClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // Escape belongs to a menu the card opened first.
      if (!cardMenuOpen()) dismiss();
    };
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerout", onPointerOut, { passive: true });
    document.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(closeTimer);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [peek]);

  return enabled ? triggerProps : {};
}
