/**
 * The learned habit table on this phone, as the web's composerHabits.ts keeps it per browser: what
 * this device has seen the owner send. Loaded once from expo-sqlite's key-value store, then kept in
 * memory and written through. See `.fork/customizations.yaml#fork-composer-next-step`.
 */
import {
  forgetHabit,
  type HabitSuggestion,
  type HabitTable,
  recordHabit,
  suggestHabit,
} from "@t3tools/client-runtime/fork-composer-habits";
import * as Schema from "effect/Schema";
import { useSyncExternalStore } from "react";

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

let table: HabitTable = {};
const listeners = new Set<() => void>();
let storage: Promise<(typeof import("expo-sqlite/kv-store"))["default"]> | null = null;

// Imported on first use, so screens and suites that never reach the pill load no native module.
function openStorage() {
  storage ??= import("expo-sqlite/kv-store").then(async ({ default: store }) => {
    try {
      const stored = await store.getItemAsync(STORAGE_KEY);
      if (stored !== null) table = decodeStoredHabits(JSON.parse(stored));
    } catch {
      // A corrupt table starts fresh rather than blocking the composer.
    }
    notify();
    return store;
  });
  return storage;
}

function notify() {
  for (const listener of listeners) listener();
}

/** Applies a change once the stored table is in, so an early send is not lost to the load. */
function updateTable(change: (current: HabitTable) => HabitTable) {
  void openStorage()
    .then((store) => {
      const next = change(table);
      if (next === table) return;
      table = next;
      notify();
      return store.setItemAsync(STORAGE_KEY, JSON.stringify(next));
    })
    .catch(() => undefined);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  void openStorage().catch(() => undefined);
  return () => {
    listeners.delete(listener);
  };
};
const readTable = () => table;

/** Counts an owner send as the follow-up to their previous message in the thread. */
export function recordNo3yComposerHabit(previous: string | null, next: string) {
  if (previous === null) return;
  updateTable((current) => recordHabit(current, previous, next, Date.now()));
}

export function forgetNo3yComposerHabit(suggestion: HabitSuggestion) {
  updateTable((current) => forgetHabit(current, suggestion.previousKey, suggestion.nextKey));
}

export function useNo3yComposerHabitSuggestion(previous: string | null): HabitSuggestion | null {
  return suggestHabit(useSyncExternalStore(subscribe, readTable, readTable), previous);
}
