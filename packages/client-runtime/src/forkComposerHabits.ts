/**
 * Learned "after X, I usually send Y" habits for the next-step pill, counted from the owner's
 * own sends on this device. See `.fork/customizations.yaml#fork-composer-next-step`.
 */

import * as Schema from "effect/Schema";

export interface HabitTable {
  readonly [previousKey: string]: {
    /** Last time this message was followed by anything, for pruning. */
    readonly at: number;
    readonly next: {
      readonly [nextKey: string]: { readonly count: number; readonly text: string };
    };
  };
}

export interface HabitSuggestion {
  readonly previousKey: string;
  readonly nextKey: string;
  readonly text: string;
}

/** Keys are the owner's words, so "constructor" must not reach Object.prototype. */
const own = <Value>(record: { readonly [key: string]: Value }, key: string): Value | undefined =>
  Object.hasOwn(record, key) ? record[key] : undefined;

const MAX_LENGTH = 80;
const MIN_COUNT = 5;
const MIN_SHARE = 0.3;
const MAX_PREVIOUS = 300;
const MAX_NEXT = 8;

const STOPWORDS = new Set(
  "a an and any all are as be can could do for go i in is it just lets me my now of on or please pls s so that the them then this to up we with would you".split(
    " ",
  ),
);
/** Acknowledgements say nothing about what comes next, and never make a useful pill. */
const ACKNOWLEDGEMENTS = new Set(
  "yes yep yeah yea no nope ok okay sure thanks thank thx continue hi hello hey good nice great cool done perfect".split(
    " ",
  ),
);

/**
 * A message's habit key: its words, lowercased, numbers collapsed (so each PR number is not its
 * own habit), filler dropped, sorted. Null for long prose, slash commands and bare
 * acknowledgements, which are not habits.
 */
export function habitKey(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_LENGTH || trimmed.startsWith("/")) return null;
  const words = trimmed
    .toLowerCase()
    .replace(/\d+/gu, " 0 ")
    .replace(/[^a-z0-9\s]+/gu, " ")
    .split(/\s+/u)
    .filter((word) => word.length > 0 && !STOPWORDS.has(word));
  if (words.every((word) => ACKNOWLEDGEMENTS.has(word))) return null;
  return [...new Set(words)].sort().join(" ");
}

/** Counts `next` as a follow-up to `previous`. A follow-up naming a number (a PR, an issue) is
    never offered later, where that number would be stale, so it is not counted. */
export function recordHabit(
  table: HabitTable,
  previous: string,
  next: string,
  now: number,
): HabitTable {
  const previousKey = habitKey(previous);
  const nextKey = habitKey(next);
  if (previousKey === null || nextKey === null || previousKey === nextKey || /\d/u.test(next)) {
    return table;
  }
  const entry = own(table, previousKey);
  const current = { count: (own(entry?.next ?? {}, nextKey)?.count ?? 0) + 1, text: next.trim() };
  // The follow-up just sent always keeps its place, so a full list can still learn a new habit;
  // the least-sent other follow-up makes room.
  const others = Object.entries(entry?.next ?? {})
    .filter(([key]) => key !== nextKey)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, MAX_NEXT - 1);
  const updated = {
    ...table,
    [previousKey]: { at: now, next: Object.fromEntries([...others, [nextKey, current]]) },
  };
  const entries = Object.entries(updated);
  if (entries.length <= MAX_PREVIOUS) return updated;
  const [oldest] = entries.reduce((a, b) => (a[1].at <= b[1].at ? a : b));
  const { [oldest]: _dropped, ...rest } = updated;
  return rest;
}

/** The follow-up the owner sends most after `previous`, once it is a habit: at least five
    times, and at least three in ten of their follow-ups. */
export function suggestHabit(table: HabitTable, previous: string | null): HabitSuggestion | null {
  const previousKey = previous === null ? null : habitKey(previous);
  const entry = previousKey === null ? undefined : own(table, previousKey);
  if (previousKey === null || entry === undefined) return null;
  const counts = Object.entries(entry.next);
  const total = counts.reduce((sum, [, { count }]) => sum + count, 0);
  const best = counts.reduce<(typeof counts)[number] | null>(
    (top, candidate) => (top === null || candidate[1].count > top[1].count ? candidate : top),
    null,
  );
  if (best === null || best[1].count < MIN_COUNT || best[1].count / total < MIN_SHARE) return null;
  return { previousKey, nextKey: best[0], text: best[1].text };
}

export function forgetHabit(table: HabitTable, previousKey: string, nextKey: string): HabitTable {
  const entry = own(table, previousKey);
  if (entry === undefined || own(entry.next, nextKey) === undefined) return table;
  const { [nextKey]: _forgotten, ...next } = entry.next;
  return { ...table, [previousKey]: { ...entry, next } };
}

/** Where a client keeps its table: localStorage on web, expo-sqlite's key-value store on iOS. */
export const HABITS_STORAGE_KEY = "t3code:fork:composer-habits:v1";

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

function parseHabits(json: string | null): HabitTable {
  if (json === null) return {};
  try {
    return decodeStoredHabits(JSON.parse(json));
  } catch {
    // A corrupt table starts fresh rather than blocking the composer.
    return {};
  }
}

export interface HabitStorage {
  readonly read: () => string | null | Promise<string | null>;
  readonly write: (json: string) => void | Promise<void>;
  /** Calls back when another window wrote the table. */
  readonly watch?: (onChange: () => void) => () => void;
}

export interface HabitStore {
  readonly subscribe: (listener: () => void) => () => void;
  /** The table as last read, cached so renders never re-parse it. */
  readonly getTable: () => HabitTable;
  /** `now` dates the entry, so the least recently used one is pruned first. */
  readonly record: (previous: string | null, next: string, now: number) => Promise<void>;
  readonly forget: (suggestion: HabitSuggestion) => Promise<void>;
}

/**
 * One device's habit table. It loads on first subscribe. Each change re-reads storage first, so
 * another window's counts and dismissals are kept, and changes run one at a time, so saves land
 * in order.
 */
export function createHabitStore(storage: HabitStorage): HabitStore {
  let table: HabitTable = {};
  let loaded = false;
  let queue: Promise<void> = Promise.resolve();
  let unwatch: (() => void) | null = null;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  // Unreadable or unwritable storage keeps whatever table this session has.
  const enqueue = (task: () => Promise<void>) => (queue = queue.then(task).catch(() => undefined));
  const reload = () =>
    enqueue(async () => {
      table = parseHabits(await storage.read());
      notify();
    });
  const update = (change: (current: HabitTable) => HabitTable) =>
    enqueue(async () => {
      const current = parseHabits(await storage.read());
      const next = change(current);
      table = next;
      notify();
      if (next !== current) await storage.write(JSON.stringify(next));
    });
  return {
    subscribe: (listener) => {
      if (listeners.size === 0) {
        unwatch = storage.watch?.(reload) ?? null;
        if (!loaded) {
          loaded = true;
          void reload();
        }
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size > 0) return;
        unwatch?.();
        unwatch = null;
      };
    },
    getTable: () => table,
    record: (previous, next, now) =>
      previous === null
        ? Promise.resolve()
        : update((current) => recordHabit(current, previous, next, now)),
    forget: (suggestion) =>
      update((current) => forgetHabit(current, suggestion.previousKey, suggestion.nextKey)),
  };
}
