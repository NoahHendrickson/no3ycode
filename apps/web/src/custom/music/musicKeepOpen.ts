/**
 * Whether the music panel follows the user from thread to thread. Its own store, because
 * subscribing to the music store follows ah ahh, which the thread header must not do. A
 * per-device convenience, so it lives in localStorage. See .fork/customizations.yaml#fork-music-panel.
 */
import { useSyncExternalStore } from "react";

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

export const getMusicKeepOpen = (): boolean => keepOpen;

export const useMusicKeepOpen = (): boolean => useSyncExternalStore(subscribe, () => keepOpen);

/**
 * With Music kept open the right panel reads as one panel across threads, so it keeps one
 * width rather than each thread's own; resizing it on any thread resizes it everywhere.
 */
export function useRightPanelWidthKey(threadWidthKey: string): string {
  return useMusicKeepOpen() ? "t3code:preview-panel-width:fork-music" : threadWidthKey;
}
