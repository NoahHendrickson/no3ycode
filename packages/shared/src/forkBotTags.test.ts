import { describe, expect, it } from "vite-plus/test";

import { ThreadId } from "@t3tools/contracts";

import {
  FORK_COORDINATOR_TAG,
  forkBotWorkOwner,
  forkBotWorkTag,
  forkSubagentTags,
  isForkBotQuietReply,
  isForkCoordinatorThread,
} from "./forkBotTags.ts";

describe("isForkCoordinatorThread", () => {
  it("is a tagged listed thread, never the subagent or side chat that inherits the tag", () => {
    const root = {
      rootThreadId: ThreadId.make("coordinator"),
      parentThreadId: null,
      relationshipToParent: null,
    };
    const tags = [FORK_COORDINATOR_TAG];
    expect(isForkCoordinatorThread({ tags, lineage: root })).toBe(true);
    expect(isForkCoordinatorThread({ tags: [], lineage: root })).toBe(false);
    const child = {
      ...root,
      parentThreadId: ThreadId.make("coordinator"),
      relationshipToParent: "subagent" as const,
    };
    expect(isForkCoordinatorThread({ tags, lineage: child })).toBe(false);
    expect(isForkCoordinatorThread({ tags, lineage: { ...root, sideChat: true } })).toBe(false);
    // A Petal or sprint, or a bot's work, keeps its own rules even if tagged.
    expect(isForkCoordinatorThread({ tags: [...tags, "bot"], lineage: root })).toBe(false);
    expect(isForkCoordinatorThread({ tags: [...tags, "bot-work:b1"], lineage: root })).toBe(false);
  });
});

describe("bot-work tags", () => {
  it("name the bot a thread works for, in one spelling", () => {
    expect(forkBotWorkTag("bot-1")).toBe("bot-work:bot-1");
    expect(forkBotWorkOwner(["triage", forkBotWorkTag("bot-1")])).toBe("bot-1");
    expect(forkBotWorkOwner(["triage"])).toBeNull();
    expect(forkBotWorkOwner(undefined)).toBeNull();
  });
});

describe("forkSubagentTags", () => {
  it("drops a bot's identity and the coordinator switch, and keeps every other tag", () => {
    expect(forkSubagentTags(["bot", "mascot:Oak"])).toEqual([]);
    expect(forkSubagentTags([FORK_COORDINATOR_TAG, "triage"])).toEqual(["triage"]);
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
