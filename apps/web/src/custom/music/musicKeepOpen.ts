/**
 * Whether the music panel follows the user from thread to thread. Its own store, because
 * subscribing to the music store follows ah ahh, which the thread view must not do. A
 * per-device convenience, so it lives in localStorage. See .fork/customizations.yaml#fork-music-panel.
 */
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { useEffect, useSyncExternalStore } from "react";

import { selectActiveRightPanel, useRightPanelStore } from "~/rightPanelStore";

import { readMusicBridge } from "./musicBridge";

const STORAGE_KEY = "t3code:fork-music-keep-open";

function read(): boolean {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

let keepOpen = read();
const listeners = new Set<() => void>();

export function setMusicKeepOpen(next: boolean): void {
  keepOpen = next;
  try {
    if (next) globalThis.localStorage?.setItem(STORAGE_KEY, "true");
    else globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: it holds for this session only.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useMusicKeepOpen = (): boolean => useSyncExternalStore(subscribe, () => keepOpen);

/**
 * With Music kept open the right panel reads as one panel across threads, so it keeps one
 * width rather than each thread's own; resizing it on any thread resizes it everywhere.
 */
export function useRightPanelWidthKey(threadWidthKey: string): string {
  return useMusicKeepOpen() ? "t3code:preview-panel-width:fork-music" : threadWidthKey;
}

/** The thread Music was last carried to; module-level, since a view can remount on one thread. */
let carriedTo: string | null = null;

/**
 * Opens Music on each thread the user arrives on while it is kept open. A thread is arrived
 * on once it can show a panel (a new agent's draft waits for its first message); closing
 * Music there afterwards leaves it closed.
 */
export function useMusicKeepOpenCarry(threadRef: ScopedThreadRef | null, ready: boolean): void {
  const threadKey = threadRef === null ? null : scopedThreadKey(threadRef);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- carries the panel to the thread just navigated to; the panel store is per thread
  useEffect(() => {
    if (threadRef === null || threadKey === null || !ready || threadKey === carriedTo) return;
    carriedTo = threadKey;
    if (!keepOpen || readMusicBridge() === null) return;
    const panels = useRightPanelStore.getState();
    if (selectActiveRightPanel(panels.byThreadKey, threadRef) !== "music") {
      panels.open(threadRef, "music");
    }
  }, [threadKey, threadRef, ready]);
}
