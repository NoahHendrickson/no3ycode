/**
 * The learned habit table, device-local: what one device's composer has seen the owner send.
 * Read from storage once and cached, so the pill never re-parses it while a turn streams. See
 * `.fork/customizations.yaml#fork-composer-next-step`.
 */
import * as Schema from "effect/Schema";
import { useSyncExternalStore } from "react";

import {
  forgetHabit,
  type HabitSuggestion,
  type HabitTable,
  recordHabit,
  suggestHabit,
} from "./composerHabits.logic";

const STORAGE_KEY = "t3code:fork:composer-habits:v1";

const StoredHabits = Schema.Record(
  Schema.String,
  Schema.Struct({
    at: Schema.Number,
    next: Schema.Record(
      Schema.String,
      Schema.Struct({ count: Schema.Number, text: Schema.String }),
    ),
  }),
);
const decodeStoredHabits = Schema.decodeUnknownSync(StoredHabits);

let table: HabitTable | null = null;
const listeners = new Set<() => void>();

function readTable(): HabitTable {
  if (table !== null) return table;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    table = stored === null ? {} : decodeStoredHabits(JSON.parse(stored));
  } catch {
    // Unreadable or corrupt storage starts a fresh table rather than blocking the composer.
    table = {};
  }
  return table;
}

function writeTable(next: HabitTable) {
  if (next === table) return;
  table = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private windows and full storage keep the in-memory table for this session.
  }
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Counts an owner send as the follow-up to their previous message in the thread. */
export function recordComposerHabit(previous: string | null, next: string) {
  if (previous === null) return;
  writeTable(recordHabit(readTable(), previous, next, Date.now()));
}

export function forgetComposerHabit(suggestion: HabitSuggestion) {
  writeTable(forgetHabit(readTable(), suggestion.previousKey, suggestion.nextKey));
}

export function useComposerHabitSuggestion(previous: string | null): HabitSuggestion | null {
  return suggestHabit(useSyncExternalStore(subscribe, readTable, readTable), previous);
}
