/**
 * Whether the music strip above the sidebar footer shows, and whether it is expanded into the
 * library. Its own store, because subscribing to the music store follows ah ahh, which the
 * button must not do. A per-device convenience, so it lives in localStorage.
 * See .fork/customizations.yaml#fork-music-panel.
 */
import { useSyncExternalStore } from "react";

import { useClosedViewStore } from "~/closedViewStore";
import { type ThreadRightPanelState, useRightPanelStore } from "~/rightPanelStore";

export type MusicStripMode = "closed" | "open" | "expanded";

const STORAGE_KEY = "t3code:fork-music-strip";

function read(): MusicStripMode {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    return stored === "open" || stored === "expanded" ? stored : "closed";
  } catch {
    return "closed";
  }
}

let mode = read();
const listeners = new Set<() => void>();

export function setMusicStripMode(next: MusicStripMode): void {
  if (next === mode) return;
  mode = next;
  try {
    if (next === "closed") globalThis.localStorage?.removeItem(STORAGE_KEY);
    else globalThis.localStorage?.setItem(STORAGE_KEY, next);
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

export const useMusicStripMode = (): MusicStripMode => useSyncExternalStore(subscribe, () => mode);

/**
 * Music used to be a right panel tab, persisted per thread and in the closed-tab history. With the
 * kind gone a stored tab would show blank and reopening one would throw, so both are dropped, and a
 * panel that was showing it closes.
 */
export function withoutRetiredMusicTabs(
  byThreadKey: Record<string, ThreadRightPanelState>,
): Record<string, ThreadRightPanelState> | null {
  let changed = false;
  const next = Object.fromEntries(
    Object.entries(byThreadKey).map(([threadKey, state]) => {
      const surfaces = state.surfaces.filter((surface) => (surface.kind as string) !== "music");
      if (surfaces.length === state.surfaces.length) return [threadKey, state];
      changed = true;
      const wasShowing = state.activeSurfaceId === "music";
      return [
        threadKey,
        {
          ...state,
          surfaces,
          isOpen: state.isOpen && !wasShowing && surfaces.length > 0,
          activeSurfaceId: wasShowing ? (surfaces[0]?.id ?? null) : state.activeSurfaceId,
        },
      ];
    }),
  );
  return changed ? next : null;
}

const retired = withoutRetiredMusicTabs(useRightPanelStore.getState().byThreadKey);
if (retired !== null) useRightPanelStore.setState({ byThreadKey: retired });

const closed = useClosedViewStore.getState().entries;
const reopenable = closed.filter(
  (entry) => entry.kind !== "panel-tab" || (entry.surface.kind as string) !== "music",
);
if (reopenable.length !== closed.length) useClosedViewStore.setState({ entries: reopenable });
