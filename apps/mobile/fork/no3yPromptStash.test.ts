import { describe, expect, it } from "vite-plus/test";

import {
  createPromptStash,
  decodeStashedPrompts,
  MAX_STASHED_PROMPTS,
  restoredDraftText,
  stashedPromptTitle,
  type StashedPrompt,
} from "./no3yPromptStash";

const prompt = (id: string, text = `prompt ${id}`): StashedPrompt => ({
  id,
  text,
  createdAt: "2026-11-22T00:00:00.000Z",
  projectTitle: "no3ycode",
});

function memory(initial: string | null = null) {
  let raw = initial;
  return {
    backend: { read: () => raw, write: (next: string) => (raw = next) },
    raw: () => raw,
  };
}

describe("no3y prompt stash", () => {
  it("keeps the newest first, at most 20, ignores empty prompts, and persists every change", () => {
    const store = memory();
    const stash = createPromptStash(store.backend);
    for (let index = 0; index < MAX_STASHED_PROMPTS + 2; index += 1)
      stash.add(prompt(String(index)));
    stash.add(prompt("blank", "   "));
    expect(stash.entries()).toHaveLength(MAX_STASHED_PROMPTS);
    expect(stash.entries()[0]!.id).toBe(String(MAX_STASHED_PROMPTS + 1));
    expect(decodeStashedPrompts(store.raw())).toEqual(stash.entries());
  });

  it("removes one entry and reloads what was saved on a fresh store", () => {
    const store = memory();
    const stash = createPromptStash(store.backend);
    stash.add(prompt("a"));
    stash.add(prompt("b"));
    stash.remove("a");
    expect(
      createPromptStash(store.backend)
        .entries()
        .map((entry) => entry.id),
    ).toEqual(["b"]);
  });

  it("notifies subscribers and survives malformed storage", () => {
    const stash = createPromptStash(
      memory('[{"id":1},{"id":"x","text":"t","createdAt":"c","projectTitle":null}]').backend,
    );
    expect(stash.entries().map((entry) => entry.id)).toEqual(["x"]);
    let calls = 0;
    const unsubscribe = stash.subscribe(() => (calls += 1));
    stash.add(prompt("y"));
    unsubscribe();
    stash.remove("y");
    expect(calls).toBe(1);
    expect(decodeStashedPrompts("not json")).toEqual([]);
  });

  it("restores into an empty composer, or replaces or appends to what is typed", () => {
    expect(restoredDraftText("  ", "stashed", "append")).toBe("stashed");
    expect(restoredDraftText("typed ", "stashed", "append")).toBe("typed\n\nstashed");
    expect(restoredDraftText("typed", "stashed", "replace")).toBe("stashed");
    expect(stashedPromptTitle("\n  First line\nsecond")).toBe("First line");
  });
});
