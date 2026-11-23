import { describe, expect, it } from "vite-plus/test";

import { no3yBotWorkByBot, no3yPetalMark, type No3yBotThreadStatus } from "./forkBots";

const thread = (
  id: string,
  tags: string[],
  overrides: Partial<Parameters<typeof no3yBotWorkByBot>[0][number]> = {},
) => ({
  environmentId: "env",
  id,
  archivedAt: null,
  pinnedAt: null,
  updatedAt: "2026-11-22T10:00:00.000Z",
  lastVisitedAt: null,
  lineage: { relationshipToParent: null, parentThreadId: null },
  source: { tags },
  ...overrides,
});

describe("no3y petal work", () => {
  const statuses: Record<string, No3yBotThreadStatus> = {
    bot: "ready",
    asks: "input",
    approves: "approval",
    fails: "failed",
    pinned: "approval",
    runs: "working",
  };
  const threads = [
    thread("bot", ["bot"]),
    thread("asks", ["bot-work:bot"]),
    thread("approves", ["bot-work:bot"]),
    thread("fails", ["bot-work:bot"], { lastVisitedAt: "2026-11-22T11:00:00.000Z" }),
    thread("pinned", ["bot-work:bot"], { pinnedAt: "2026-11-22T09:00:00.000Z" }),
    thread("runs", [], { lineage: { relationshipToParent: "subagent", parentThreadId: "bot" } }),
  ];
  const work = no3yBotWorkByBot(
    threads,
    (candidate) => statuses[candidate.id]!,
    (candidate) => statuses[candidate.id] === "working",
  ).get("env:bot");

  it("counts unpinned work that needs you, most pressing first, and a read failure not at all", () => {
    expect(work).toEqual({ attention: { status: "approval", count: 2 }, working: true });
  });

  it("lets the work's need of you mark an idle petal, never a busy or newsy one", () => {
    expect(no3yPetalMark(null, "ready", work)).toEqual({
      kind: "approval",
      attention: { status: "approval", count: 2 },
    });
    expect(no3yPetalMark("working", "working", work).kind).toBe("working");
    expect(no3yPetalMark("done", "ready", { attention: null, working: true }).kind).toBe("done");
    expect(no3yPetalMark(null, "ready", { attention: null, working: true }).kind).toBe("working");
  });
});
