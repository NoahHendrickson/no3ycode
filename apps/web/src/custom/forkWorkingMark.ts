/**
 * Working indicator choice — see `.fork/customizations.yaml#fork-working-mark`.
 *
 * Which mark a running agent draws everywhere the fork shows one; Inlet
 * defaults to the bead ring, other palettes to the helix. Device-local, like
 * the palette: a contracts field would put a fork key in a schema upstream owns.
 */
import * as Schema from "effect/Schema";
import { useSyncExternalStore } from "react";

import {
  getLocalStorageItem,
  removeLocalStorageItem,
  setLocalStorageItem,
} from "~/hooks/useLocalStorage";

import { useIsInletActive } from "./forkActivePalette";

const STORAGE_KEY = "t3code:fork:working-mark:v2";
/** v1 stored "helix" for a reset as well as a pick, so only its other picks carry over. */
const LEGACY_STORAGE_KEY = "t3code:fork:working-mark:v1";

export const FORK_WORKING_MARKS = ["helix", "rain", "bead"] as const;
export type ForkWorkingMark = (typeof FORK_WORKING_MARKS)[number];

function defaultForkWorkingMark(inlet: boolean): ForkWorkingMark {
  return inlet ? "bead" : "helix";
}

export const FORK_WORKING_MARK_LABELS: Record<ForkWorkingMark, string> = {
  helix: "DNA helix",
  rain: "Pixel rain",
  bead: "Bead ring",
};

const ForkWorkingMarkSchema = Schema.Literals(FORK_WORKING_MARKS);

export const isForkWorkingMark = Schema.is(ForkWorkingMarkSchema);

// One module-level store rather than `useLocalStorage` per mark: every working
// row, the transcript row and the composer pill each mount one, and the latter
// two re-render on every streamed chunk. This decodes storage once per change
// and holds one window listener however many marks are mounted.
const listeners = new Set<() => void>();
/** The picked mark, or null while none is (the palette's default then). */
let snapshot: ForkWorkingMark | null | undefined;

function readWorkingMark(): ForkWorkingMark | null {
  try {
    const picked = getLocalStorageItem(STORAGE_KEY, ForkWorkingMarkSchema);
    if (picked !== null) return picked;
    const legacy = getLocalStorageItem(LEGACY_STORAGE_KEY, ForkWorkingMarkSchema);
    return legacy === "helix" ? null : legacy;
  } catch {
    return null;
  }
}

function getSnapshot(): ForkWorkingMark | null {
  if (snapshot === undefined) snapshot = readWorkingMark();
  return snapshot;
}

function notify(): void {
  snapshot = undefined;
  for (const listener of listeners) listener();
}

function handleStorage(event: StorageEvent): void {
  if (event.key === STORAGE_KEY || event.key === LEGACY_STORAGE_KEY || event.key === null) {
    notify();
  }
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener("storage", handleStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", handleStorage);
  };
}

/** null clears the pick, so the palette's default applies again. */
function setForkWorkingMark(mark: ForkWorkingMark | null): void {
  try {
    removeLocalStorageItem(LEGACY_STORAGE_KEY);
    if (mark === null) removeLocalStorageItem(STORAGE_KEY);
    else setLocalStorageItem(STORAGE_KEY, mark, ForkWorkingMarkSchema);
  } catch (error) {
    console.error("[fork-working-mark] Could not store the working indicator.", error);
  }
  // Re-read rather than trusting `mark`: a failed write must not show a choice
  // that a reload would drop.
  notify();
}

/** The stored pick, null while none is, and its setter (null restores the palette's default). */
export function useForkWorkingMarkPick(): [
  ForkWorkingMark | null,
  (mark: ForkWorkingMark | null) => void,
] {
  return [useSyncExternalStore(subscribe, getSnapshot, () => null), setForkWorkingMark];
}

/** The mark to draw: the pick, else the palette's default. */
export function useForkWorkingMark(): ForkWorkingMark {
  const [picked] = useForkWorkingMarkPick();
  const fallback = defaultForkWorkingMark(useIsInletActive());
  return picked ?? fallback;
}
