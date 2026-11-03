/**
 * Collapsed-sidebar peek — see `.fork/customizations.yaml#fork-sidebar-peek`.
 * Module state: the trigger and the panel are siblings under the provider.
 * "closed" (just dismissed) drops the slide transition so the card vanishes.
 */

import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { isContextMenuOpen } from "../contextMenuFallback";

export type SidebarPeekState = "off" | "open" | "closed";

const OPEN_DELAY_MS = 80;
const CLOSE_DELAY_MS = 200;
const PANEL_SELECTOR = '[data-app-sidebar][data-slot="sidebar-container"]';
const TRIGGER_SELECTOR = "[data-sidebar-peek-trigger]";

let state: SidebarPeekState = "off";
let openTimer: ReturnType<typeof setTimeout> | undefined;
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

export function useSidebarPeekState(): SidebarPeekState {
  return useSyncExternalStore(subscribe, () => state);
}

function closeSidebarPeek() {
  cancelOpen();
  if (state === "open") setState("closed");
}

/** Clicking the trigger pins the sidebar open, which ends any peek outright. */
export function resetSidebarPeek() {
  cancelOpen();
  setState("off");
}

export const sidebarPeekTriggerProps = {
  "data-sidebar-peek-trigger": "",
  onPointerEnter: (event: ReactPointerEvent) => {
    if (event.pointerType === "touch") return;
    cancelOpen();
    openTimer = setTimeout(() => setState("open"), OPEN_DELAY_MS);
  },
  onPointerLeave: () => {
    if (state !== "open") cancelOpen();
  },
};

// Menus the card opens render outside it: portaled popups, and the web build's
// DOM thread context menu. Native Electron menus capture input while open.
function cardMenuOpen(): boolean {
  return (
    isContextMenuOpen() || document.querySelector(`${PANEL_SELECTOR} [data-popup-open]`) !== null
  );
}

function keepsPeekOpen(target: EventTarget | null): boolean {
  if (target instanceof Element && target.closest(`${PANEL_SELECTOR}, ${TRIGGER_SELECTOR}`)) {
    return true;
  }
  return cardMenuOpen();
}

/**
 * Dismisses the card when the pointer leaves it (after a short grace so the gap
 * under the trigger can be crossed), on Escape, on navigation, and when the
 * sidebar is opened for real.
 */
export function useSidebarPeekLifecycle({
  enabled,
  pathname,
}: {
  enabled: boolean;
  pathname: string;
}) {
  const peek = useSidebarPeekState();

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- resets the module store when the sidebar opens or the peek host goes away
  useEffect(() => {
    if (!enabled) resetSidebarPeek();
  }, [enabled]);

  const openedOn = useRef<string | null>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- picking a thread in the card navigates; the card closes like a menu would
  useEffect(() => {
    if (peek !== "open") {
      openedOn.current = null;
      return;
    }
    openedOn.current ??= pathname;
    if (openedOn.current !== pathname) closeSidebarPeek();
  }, [peek, pathname]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- document pointer and key listeners live only while the card is open
  useEffect(() => {
    if (peek !== "open") return;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleClose = () => {
      closeTimer ??= setTimeout(closeSidebarPeek, CLOSE_DELAY_MS);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      if (!keepsPeekOpen(event.target)) {
        scheduleClose();
        return;
      }
      clearTimeout(closeTimer);
      closeTimer = undefined;
    };
    // relatedTarget is null when the pointer leaves the window.
    const onPointerOut = (event: PointerEvent) => {
      if (event.relatedTarget === null && !cardMenuOpen()) scheduleClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // Escape belongs to a menu the card opened first.
      if (!cardMenuOpen()) closeSidebarPeek();
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
}
