import { describe, expect, it } from "vite-plus/test";

import {
  forkBotWorkOwner,
  forkBotWorkTag,
  forkSubagentTags,
  isForkBotQuietReply,
} from "./forkBotTags.ts";

describe("bot-work tags", () => {
  it("name the bot a thread works for, in one spelling", () => {
    expect(forkBotWorkTag("bot-1")).toBe("bot-work:bot-1");
    expect(forkBotWorkOwner(["triage", forkBotWorkTag("bot-1")])).toBe("bot-1");
    expect(forkBotWorkOwner(["triage"])).toBeNull();
    expect(forkBotWorkOwner(undefined)).toBeNull();
  });
});

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

describe("isForkBotQuietReply", () => {
  it("reads the quiet reply loosely, trimming only what the server's report trims", () => {
    for (const reply of ["Nothing to report.", " nothing to report\n", "NOTHING TO REPORT"]) {
      expect(isForkBotQuietReply(reply)).toBe(true);
    }
    expect(isForkBotQuietReply("Nothing to report. ")).toBe(false);
    expect(isForkBotQuietReply("Nothing to report. Rent is due.")).toBe(false);
  });
});
