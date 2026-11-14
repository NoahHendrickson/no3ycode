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
  selectThreadRightPanelState,
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

const showsMusic = (state: ThreadRightPanelState): boolean =>
  state.isOpen &&
  state.surfaces.some(
    (surface) => surface.kind === "music" && surface.id === state.activeSurfaceId,
  );

/** The state each thread was last brought in line with; module-level, since a view can remount
    on one thread, and per thread, since split panes mount several views at once. */
const synced = new Map<string, boolean>();

/**
 * Keeps one thread in view and Music's shared state in step, both ways. The thread follows the
 * state when the user arrives on it and when the state changes; the state follows what the user
 * does to this thread's panel. A thread is arrived on once it can show a panel (a new agent's
 * draft waits for its first message); a tab picked there afterwards is left alone.
 */
export function useMusicKeepOpenCarry(threadRef: ScopedThreadRef | null, ready: boolean): void {
  const threadKey = threadRef === null ? null : scopedThreadKey(threadRef);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- keeps the thread's panel and Music's shared state in step; the panel store is per thread
  useEffect(() => {
    if (threadRef === null || threadKey === null || !ready) return;
    const sync = () => {
      if (synced.get(threadKey) === keepOpen) return;
      synced.set(threadKey, keepOpen);
      if (readMusicBridge() === null) return;
      const panels = useRightPanelStore.getState();
      const showing = selectActiveRightPanel(panels.byThreadKey, threadRef) === "music";
      if (keepOpen && !showing) panels.open(threadRef, "music");
      else if (!keepOpen && showing) panels.close(threadRef);
    };
    sync();
    const stopFollowingState = subscribe(sync);
    const stopFollowingPanel = useRightPanelStore.subscribe((next, previous) => {
      // Only what the user did here: a deleted thread drops its revision, and the app revealing
      // another tab never moves it.
      const revision = next.userActionRevisionByThreadKey[threadKey];
      if (
        revision === undefined ||
        revision === previous.userActionRevisionByThreadKey[threadKey]
      ) {
        return;
      }
      const before = selectThreadRightPanelState(previous.byThreadKey, threadRef);
      const after = selectThreadRightPanelState(next.byThreadKey, threadRef);
      if (after === before) return;
      if (showsMusic(after)) {
        if (!showsMusic(before)) setMusicKeepOpen(true);
        // Closed: its tab went, in front or behind another, or the panel showing it was closed.
        // Another tab taking the panel over is neither.
      } else if ((hasMusic(before) && !hasMusic(after)) || (showsMusic(before) && !after.isOpen)) {
        setMusicKeepOpen(false);
      }
    });
    return () => {
      stopFollowingState();
      stopFollowingPanel();
    };
  }, [threadKey, threadRef, ready]);
}
