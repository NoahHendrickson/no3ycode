import { describe, expect, it } from "vite-plus/test";

import { forkSubagentTags } from "./forkBotTags.ts";

describe("forkSubagentTags", () => {
  it("drops a bot's identity and keeps every other tag", () => {
    expect(forkSubagentTags(["bot", "mascot:Oak"])).toEqual([]);
    expect(forkSubagentTags(["bot-work:bot-thread", "triage"])).toEqual([
      "bot-work:bot-thread",
      "triage",
    ]);
    expect(forkSubagentTags(undefined)).toBeUndefined();
  });
});
