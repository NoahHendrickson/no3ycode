/**
 * The learned habit table in this browser's localStorage, kept by client-runtime's habit store.
 * See `.fork/customizations.yaml#fork-composer-next-step`.
 */
import {
  createHabitStore,
  HABITS_STORAGE_KEY,
  type HabitSuggestion,
  suggestHabit,
} from "@t3tools/client-runtime/fork-composer-habits";
import { useSyncExternalStore } from "react";

const store = createHabitStore({
  read: () => localStorage.getItem(HABITS_STORAGE_KEY),
  write: (json) => localStorage.setItem(HABITS_STORAGE_KEY, json),
  watch: (onChange) => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === HABITS_STORAGE_KEY || event.key === null) onChange();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  },
});

/** Counts an owner send as the follow-up to their previous message in the thread. */
export function recordComposerHabit(previous: string | null, next: string) {
  void store.record(previous, next, Date.now());
}

export function forgetComposerHabit(suggestion: HabitSuggestion) {
  void store.forget(suggestion);
}

export function useComposerHabitSuggestion(previous: string | null): HabitSuggestion | null {
  return suggestHabit(useSyncExternalStore(store.subscribe, store.getTable), previous);
}
