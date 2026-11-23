import { describe, expect, it } from "vite-plus/test";

import type { SidebarV2CardStatusKind } from "./forkStatusGrouping";
import { groupNo3yRuns, no3yAutomationTileStatus } from "./no3yAutomationRuns";

describe("no3y automation run groups", () => {
  const runs: ReadonlyArray<readonly [string, SidebarV2CardStatusKind | null]> = [
    ["a", "done"],
    ["b", "working"],
    ["c", "failed"],
    ["d", null],
    ["e", "input"],
  ];
  const summary = (limit: number) =>
    groupNo3yRuns(runs, (run) => run[1], limit).map(
      ({ group, runs: inGroup }) => `${group}:${inGroup.map((run) => run[0]).join("")}`,
    );

  it("puts runs that need you first, then working, then the rest, each in recency order", () => {
    expect(summary(25)).toEqual(["needs-you:ce", "working:b", "recent:ad"]);
  });

  it("shows a page at a time across the groups", () => {
    expect(summary(3)).toEqual(["needs-you:ce", "working:b"]);
    expect(summary(4)).toEqual(["needs-you:ce", "working:b", "recent:a"]);
  });
});

describe("no3y automation tile status", () => {
  const now = Date.parse("2026-11-22T12:00:00.000Z");
  const task = {
    enabled: true,
    lastRunStatus: "succeeded" as const,
    lastRunAt: "2026-11-22T10:00:00.000Z",
    nextRunAt: null,
  };

  it("shows a running or failed last run, Paused when off, else the next or last run", () => {
    expect(no3yAutomationTileStatus({ ...task, lastRunStatus: "running" }, now)).toEqual({
      line: "Running now",
      mark: "working",
    });
    expect(no3yAutomationTileStatus({ ...task, enabled: false }, now).line).toBe("Paused");
    expect(no3yAutomationTileStatus({ ...task, lastRunStatus: "failed" }, now)).toEqual({
      line: "Last run failed",
      mark: "failed",
    });
    expect(
      no3yAutomationTileStatus({ ...task, nextRunAt: "2026-11-22T12:30:00.000Z" }, now).line,
    ).toBe("Next run in 30 minutes");
    expect(no3yAutomationTileStatus(task, now).line).toBe("Last run 2h ago");
    expect(
      no3yAutomationTileStatus({ ...task, lastRunStatus: "never", lastRunAt: null }, now).line,
    ).toBe("Not run yet");
  });
});
