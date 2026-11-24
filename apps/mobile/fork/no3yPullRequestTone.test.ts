import type { PullRequestCheck, ThreadPullRequestLink } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { presentThreadLinkedPullRequests } from "../src/state/thread-pr-presentation";
import { flatGlassPalette } from "./flatGlassTheme";
import {
  no3yPullRequestColor,
  no3yPullRequestPill,
  no3yPullRequestTone,
  no3yWatcherChecksState,
} from "./no3yPullRequestTone";

function linkedPr(
  number: number,
  snapshot: Partial<NonNullable<ThreadPullRequestLink["snapshot"]>> = {},
): ThreadPullRequestLink {
  return {
    host: "github.com",
    repository: "t3tools/t3code",
    number,
    url: `https://github.com/t3tools/t3code/pull/${number}`,
    source: "manual",
    linkedAt: "2026-09-08T00:00:00.000Z",
    stack: null,
    snapshot: {
      state: "open",
      title: `Change ${number}`,
      headBranch: `change-${number}`,
      baseBranch: "main",
      isDraft: false,
      updatedAt: null,
      syncedAt: "2026-09-08T00:00:00.000Z",
      ...snapshot,
    },
  };
}

function pill(links: ReadonlyArray<ThreadPullRequestLink>) {
  const pr = presentThreadLinkedPullRequests(links);
  if (pr === null) throw new Error("no presentation");
  return no3yPullRequestPill(pr, links);
}

describe("no3y pull request tone", () => {
  it("tells open, merged, closed and draft apart, as the Mac does", () => {
    expect(no3yPullRequestTone({ state: "open", isDraft: false })).toBe("open");
    expect(no3yPullRequestTone({ state: "open", isDraft: true })).toBe("draft");
    expect(no3yPullRequestTone({ state: "merged", isDraft: false })).toBe("merged");
    expect(no3yPullRequestTone({ state: "closed", isDraft: false })).toBe("closed");
    // Before its state arrives a pull request reads as open.
    expect(no3yPullRequestTone({ state: null, isDraft: false })).toBe("open");
  });

  it("gives each state its own colour on both appearances", () => {
    for (const appearance of ["dark", "light"] as const) {
      const palette = flatGlassPalette(appearance);
      const colors = (["open", "merged", "closed", "draft"] as const).map((tone) =>
        no3yPullRequestColor(tone, palette),
      );
      expect(new Set(colors).size).toBe(4);
    }
    expect(no3yPullRequestColor("merged", flatGlassPalette("dark"))).toBe(
      "rgba(196, 180, 255, 0.9)",
    );
  });
});

describe("no3y pull request pill", () => {
  it("marks running and failing checks on a single open pull request only", () => {
    expect(pill([linkedPr(240, { checksState: "pending" })])).toMatchObject({
      tone: "open",
      several: false,
      more: 0,
      checks: "pending",
      checksLink: { number: 240 },
    });
    expect(pill([linkedPr(240, { checksState: "failing" })]).checks).toBe("failing");
    expect(pill([linkedPr(240, { state: "merged", checksState: "pending" })]).checks).toBeNull();
  });

  it("counts how many more a stack or several linked pull requests hold", () => {
    // A derived stack: each layer's base is the one below it.
    const stack = [
      linkedPr(1),
      linkedPr(2, { baseBranch: "change-1" }),
      linkedPr(3, { baseBranch: "change-2" }),
      linkedPr(4, { baseBranch: "change-3", checksState: "pending" }),
    ];
    expect(pill(stack)).toMatchObject({ several: true, more: 3, checks: null });
    expect(pill([linkedPr(7), linkedPr(8)])).toMatchObject({ several: true, more: 1 });
  });
});

describe("no3y watcher checks state", () => {
  const SYNCED_AT = "2026-09-08T00:00:00.000Z";
  const check = (
    name: string,
    status: PullRequestCheck["status"],
    required?: boolean,
  ): PullRequestCheck => ({
    name,
    status,
    description: null,
    url: null,
    ...(required === undefined ? {} : { required }),
  });
  const live = (checks: ReadonlyArray<PullRequestCheck>, observedAt = Date.parse(SYNCED_AT)) => ({
    observedAt,
    state: "open" as const,
    checks,
  });
  const LINK = linkedPr(240);

  it("gates on required checks when the host names any, as the watcher does", () => {
    const optionalRunning = [check("Lint", "success", true), check("Test Web 1", "pending", false)];
    expect(no3yWatcherChecksState("pending", live(optionalRunning), LINK)).toBe("passing");
    const optionalFailed = [check("Lint", "success", true), check("Flaky", "failure", false)];
    expect(no3yWatcherChecksState("failing", live(optionalFailed), LINK)).toBe("passing");
    const requiredRunning = [check("Lint", "pending", true), check("Flaky", "failure", false)];
    expect(no3yWatcherChecksState("failing", live(requiredRunning), LINK)).toBe("pending");
    const requiredFailed = [check("Lint", "cancelled", true), check("Test", "pending", true)];
    expect(no3yWatcherChecksState("pending", live(requiredFailed), LINK)).toBe("failing");
    // No required checks named: every check counts.
    const noneRequired = [check("Lint", "success"), check("Test", "action-required")];
    expect(no3yWatcherChecksState("pending", live(noneRequired), LINK)).toBe("pending");
    // An unapproved workflow run holds the watcher even when it is not required.
    const awaitingApproval = [check("Lint", "success", true), check("Fork CI", "action-required")];
    expect(no3yWatcherChecksState("pending", live(awaitingApproval), LINK)).toBe("pending");
  });

  it("keeps the snapshot's rollup without a read at least as new as it", () => {
    const passed = [check("Lint", "success", true)];
    expect(no3yWatcherChecksState("pending", null, LINK)).toBe("pending");
    expect(no3yWatcherChecksState("pending", live([]), LINK)).toBe("pending");
    expect(no3yWatcherChecksState("pending", live(passed, Date.parse(SYNCED_AT) - 1), LINK)).toBe(
      "pending",
    );
    expect(no3yWatcherChecksState("passing", live([check("Lint", "pending", true)]), LINK)).toBe(
      "passing",
    );
  });

  it("keeps the watcher's approval hold under a passing or absent rollup and reads that omit it", () => {
    const run = "https://github.com/t3tools/t3code/actions/runs/1";
    const watch = {
      startedAt: SYNCED_AT,
      headSha: "abc1234",
      failedChecks: [],
      passed: false,
      passedChecks: [],
      awaitingApproval: [run],
      remarksThrough: SYNCED_AT,
      remarkIds: [],
      conflicting: false,
      wakes: 0,
    };
    const held = { ...LINK, watch };
    expect(no3yWatcherChecksState("passing", null, held)).toBe("pending");
    expect(no3yWatcherChecksState(null, null, held)).toBe("pending");
    // GitHub's approval lookup came back empty this time; the watcher still holds the run.
    const omitted = live([check("Lint", "success", true)]);
    expect(no3yWatcherChecksState("pending", omitted, held)).toBe("pending");
    expect(no3yWatcherChecksState("pending", omitted, LINK)).toBe("passing");
    // A push or a finished run clears the watcher's hold, and the mark goes with it.
    const cleared = { ...LINK, watch: { ...watch, awaitingApproval: [] } };
    expect(no3yWatcherChecksState("pending", omitted, cleared)).toBe("passing");
    expect(no3yWatcherChecksState("passing", null, cleared)).toBe("passing");
  });
});
