/**
 * The learned habit table on this phone, in expo-sqlite's key-value store, kept by client-runtime's
 * habit store, so each device learns apart. See `.fork/customizations.yaml#fork-composer-next-step`.
 */
import {
  createHabitStore,
  HABITS_STORAGE_KEY,
  type HabitSuggestion,
  suggestHabit,
} from "@t3tools/client-runtime/fork-composer-habits";
import { useSyncExternalStore } from "react";

// Imported on first use, so screens and suites that never reach the pill load no native module.
const keyValueStore = () => import("expo-sqlite/kv-store").then((module) => module.default);

const store = createHabitStore({
  read: async () => (await keyValueStore()).getItemAsync(HABITS_STORAGE_KEY),
  write: async (json) => (await keyValueStore()).setItemAsync(HABITS_STORAGE_KEY, json),
});

/** Counts an owner send as the follow-up to their previous message in the thread. */
export function recordNo3yComposerHabit(previous: string | null, next: string) {
  void store.record(previous, next, Date.now());
}

export function forgetNo3yComposerHabit(suggestion: HabitSuggestion) {
  void store.forget(suggestion);
}

export function useNo3yComposerHabitSuggestion(previous: string | null): HabitSuggestion | null {
  return suggestHabit(useSyncExternalStore(store.subscribe, store.getTable), previous);
}
