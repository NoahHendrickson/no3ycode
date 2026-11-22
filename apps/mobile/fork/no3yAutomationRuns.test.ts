import { describe, expect, it } from "vite-plus/test";

import type { SidebarV2CardStatusKind } from "./forkStatusGrouping";
import { groupNo3yRuns } from "./no3yAutomationRuns";

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
