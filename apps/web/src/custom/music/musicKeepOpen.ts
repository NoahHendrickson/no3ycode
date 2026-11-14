/**
 * Music is open or closed on every thread at once. Its own store, because subscribing to the
 * music store follows ah ahh, which the thread view must not do. A per-device convenience, so
 * it lives in localStorage. See .fork/customizations.yaml#fork-music-panel.
 */
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { useEffect, useSyncExternalStore } from "react";

import {
  selectActiveRightPanel,
  type ThreadRightPanelState,
  useRightPanelStore,
} from "~/rightPanelStore";

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
  if (next === keepOpen) return;
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
  return () => {
    listeners.delete(listener);
  };
}

const useMusicKeepOpen = (): boolean => useSyncExternalStore(subscribe, () => keepOpen);

/**
 * With Music open the right panel reads as one panel across threads, so it keeps one
 * width rather than each thread's own; resizing it on any thread resizes it everywhere.
 */
export function useRightPanelWidthKey(threadWidthKey: string): string {
  return useMusicKeepOpen() ? "t3code:preview-panel-width:fork-music" : threadWidthKey;
}

const hasMusic = (state: ThreadRightPanelState): boolean =>
  state.surfaces.some((surface) => surface.kind === "music");

const showsMusic = (state: ThreadRightPanelState | undefined): boolean =>
  state?.isOpen === true &&
  state.surfaces.some(
    (surface) => surface.kind === "music" && surface.id === state.activeSurfaceId,
  );

// However Music came to show or to close on a thread (its button, its tab, the panel's own
// toggle), that is its state everywhere. Another tab taking the panel over is not a close.
useRightPanelStore.subscribe((next, previous) => {
  if (next.byThreadKey === previous.byThreadKey) return;
  for (const [threadKey, state] of Object.entries(next.byThreadKey)) {
    const before = previous.byThreadKey[threadKey];
    if (state === before) continue;
    if (showsMusic(state)) setMusicKeepOpen(true);
    else if (showsMusic(before) && (!state.isOpen || !hasMusic(state))) setMusicKeepOpen(false);
  }
});

/** The thread and state last brought in line; module-level, since a view can remount on one thread. */
let synced: string | null = null;

/**
 * Brings each thread the user arrives on in line with Music's state, and the thread in view
 * when that state changes. A thread is arrived on once it can show a panel (a new agent's
 * draft waits for its first message); picking another tab there afterwards is left alone.
 */
export function useMusicKeepOpenCarry(threadRef: ScopedThreadRef | null, ready: boolean): void {
  const threadKey = threadRef === null ? null : scopedThreadKey(threadRef);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- brings the thread's panel in line with Music's shared state; the panel store is per thread
  useEffect(() => {
    if (threadRef === null || threadKey === null || !ready) return;
    const sync = () => {
      const arrival = `${threadKey}:${keepOpen}`;
      if (arrival === synced) return;
      synced = arrival;
      if (readMusicBridge() === null) return;
      const panels = useRightPanelStore.getState();
      const showing = selectActiveRightPanel(panels.byThreadKey, threadRef) === "music";
      if (keepOpen && !showing) panels.open(threadRef, "music");
      else if (!keepOpen && showing) panels.close(threadRef);
    };
    sync();
    return subscribe(sync);
  }, [threadKey, threadRef, ready]);
}
