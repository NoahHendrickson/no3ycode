import { describe, expect, it } from "vite-plus/test";

import {
  forgetHabit,
  habitKey,
  type HabitTable,
  recordHabit,
  suggestHabit,
} from "./forkComposerHabits.ts";

const repeat = (table: HabitTable, previous: string, next: string, times: number) => {
  let result = table;
  for (let index = 0; index < times; index++) result = recordHabit(result, previous, next, index);
  return result;
};

describe("habitKey", () => {
  it("treats phrasings of one request alike", () => {
    expect(habitKey("Open a PR please.")).toBe(habitKey("lets open a pr"));
    expect(habitKey("code-review pr40")).toBe(habitKey("Code review PR 451"));
  });

  it("survives words that name Object.prototype members", () => {
    const table = repeat({}, "the constructor", "open a pr", 5);
    expect(suggestHabit({}, "is it the constructor?")).toBe(null);
    expect(suggestHabit(table, "in the constructor")?.text).toBe("open a pr");
    expect(forgetHabit({}, "constructor", "tostring")).toEqual({});
  });

  it("ignores prose, slash commands and acknowledgements", () => {
    expect(habitKey("x".repeat(81))).toBe(null);
    expect(habitKey("/compact")).toBe(null);
    expect(habitKey("yes please")).toBe(null);
    expect(habitKey("ok thanks")).toBe(null);
  });
});

describe("suggestHabit", () => {
  it("offers a follow-up once it is a habit", () => {
    const four = repeat({}, "run a neon review", "open a pr", 4);
    expect(suggestHabit(four, "Run a neon review")).toBe(null);
    const five = recordHabit(four, "run a neon review", "Open a PR", 5);
    expect(suggestHabit(five, "run a neon review please")?.text).toBe("Open a PR");
  });

  it("stays quiet when no follow-up dominates", () => {
    let table = repeat({}, "fix the sidebar", "run a sol loop", 5);
    for (const other of ["make it bigger", "try again", "use the old colour", "undo that"]) {
      table = repeat(table, "fix the sidebar", other, 3);
    }
    // 5 of 17 is under three in ten.
    expect(suggestHabit(table, "fix the sidebar")).toBe(null);
  });

  it("never learns a follow-up naming a number, which would be stale later", () => {
    const table = repeat({}, "open a pr", "watch pr 447", 6);
    expect(suggestHabit(table, "open a pr")).toBe(null);
  });

  it("still learns a new follow-up once a message has a full list of them", () => {
    let table: HabitTable = {};
    for (const other of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      table = recordHabit(table, "run a sol loop", `try ${other}`, 0);
    }
    table = repeat(table, "run a sol loop", "open a pr", 5);
    expect(suggestHabit(table, "run a sol loop")?.text).toBe("open a pr");
  });

  it("forgets a dismissed habit", () => {
    const table = repeat({}, "run a neon review", "open a pr", 5);
    const suggestion = suggestHabit(table, "run a neon review");
    expect(suggestion).not.toBe(null);
    const forgotten = forgetHabit(table, suggestion!.previousKey, suggestion!.nextKey);
    expect(suggestHabit(forgotten, "run a neon review")).toBe(null);
  });
});

describe("recordHabit", () => {
  it("drops the least recently used message past the cap", () => {
    const word = (index: number) =>
      [26 * 26, 26, 1]
        .map((unit) => String.fromCharCode(97 + (Math.floor(index / unit) % 26)))
        .join("");
    let table: HabitTable = {};
    for (let index = 0; index <= 300; index++) {
      table = recordHabit(table, `fix ${word(index)}`, "open a pr", index);
    }
    expect(Object.keys(table)).toHaveLength(300);
    expect(table[habitKey("fix aaa")!]).toBeUndefined();
    expect(table[habitKey(`fix ${word(300)}`)!]).toBeDefined();
  });
});
