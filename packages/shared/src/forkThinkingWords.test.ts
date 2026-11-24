import { describe, expect, it } from "vite-plus/test";

import { forkThinkingWord } from "./forkThinkingWords.ts";

describe("forkThinkingWord", () => {
  it("gives one seed one word, and spreads seeds across the list", () => {
    expect(forkThinkingWord("entry-1")).toBe(forkThinkingWord("entry-1"));
    const words = new Set(Array.from({ length: 50 }, (_, i) => forkThinkingWord(`entry-${i}`)));
    expect(words.size).toBeGreaterThan(10);
    expect(words.has("Thinking")).toBe(false);
  });
});
