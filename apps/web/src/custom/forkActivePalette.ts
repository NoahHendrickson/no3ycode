/** The fork palette painted now, as forkTheme.ts resolved it: stored, and on the appearance it
    sits on. Its own module, importing nothing from the app: the lucide-react shim
    (custom/icons/lucide-hugeicons) reads it, and forkTheme.ts's imports reach that shim. */
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

const readActive = () => active;

/** The palette painted now, null while an imported or built-in upstream theme is on. */
export function useActiveForkPalette(): ForkPalettePreference {
  return useSyncExternalStore(subscribe, readActive, () => null);
}

/** Every fork palette draws the icons' filled weight where upstream themes draw them stroked. */
export function forkPaletteFillsIcons(palette: ForkPalettePreference): boolean {
  return palette !== null;
}
