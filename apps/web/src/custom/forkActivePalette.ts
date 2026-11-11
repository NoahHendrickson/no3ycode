/** The fork palette painted now, as forkTheme.ts resolved it: stored, and on the appearance it
    sits on. Its own module, importing nothing from the app: the lucide-react shim
    (custom/icons/lucide-phosphor) reads it, and forkTheme.ts's imports reach that shim. */
import { useSyncExternalStore } from "react";

import type { ForkPalettePreference } from "./forkTheme";

let active: ForkPalettePreference = null;
const listeners = new Set<() => void>();

/** forkTheme.ts's synchronization pass is the only writer. */
export function setActiveForkPalette(next: ForkPalettePreference): void {
  if (next === active) return;
  active = next;
  for (const listener of listeners) listener();
}

export function isInletActive(): boolean {
  return active === "inlet";
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useIsInletActive(): boolean {
  return useSyncExternalStore(subscribe, isInletActive, () => false);
}
