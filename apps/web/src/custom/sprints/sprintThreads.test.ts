import { describe, expect, it } from "vite-plus/test";

import type { ModelSelection } from "@t3tools/contracts";

import {
  parseSprintGoal,
  parseSprintThreadModel,
  sprintGoalLine,
  sprintThreadModelLine,
  withSprintGoal,
  withSprintThreadModel,
} from "./sprintThreads";

describe("parseSprintGoal", () => {
  it.each([
    ["# Plan\n\nGoal: Ship the composer\n", "Ship the composer"],
    ["# Plan\n\n**Goal:** Ship the composer\n", "Ship the composer"],
    ["# Plan\n\n- Goal: Ship the composer\n", "Ship the composer"],
    ["# Plan\n\nGoal: Not set.\n", null],
    ["# Plan\n\nGoal:\n", null],
    ["# Plan\n\n## Phases\n", null],
    ["Goal: First\nGoal: Second\n", "First"],
  ])("reads %j as %j", (plan, goal) => {
    expect(parseSprintGoal(plan)).toBe(goal);
  });

  it("round-trips the line it writes, on one line", () => {
    expect(parseSprintGoal(sprintGoalLine("  Ship\n the composer "))).toBe("Ship the composer");
    expect(parseSprintGoal(sprintGoalLine(""))).toBeNull();
  });
});

describe("withSprintGoal", () => {
  it.each([
    [
      "rewrites the goal line and keeps the rest",
      "# Plan\n\n**Goal:** Old\n\nPace: keep going\n",
      "# Plan\n\nGoal: New goal\n\nPace: keep going\n",
    ],
    [
      "puts one back under the title when the sprint dropped it",
      "# Plan\n\nPace: check with me\n",
      "# Plan\n\nGoal: New goal\n\nPace: check with me\n",
    ],
    ["starts a file with no title", "Pace: keep going\n", "Goal: New goal\n\nPace: keep going\n"],
  ])("%s", (_name, plan, expected) => {
    expect(withSprintGoal(plan, "New  goal")).toBe(expected);
  });

  it("clears to Not set.", () => {
    expect(parseSprintGoal(withSprintGoal("# Plan\n\nGoal: Old\n", ""))).toBeNull();
  });
});

describe("sprint thread model", () => {
  const sonnet = {
    instanceId: "claudeAgent",
    model: "claude-sonnet-5-5",
    options: [{ id: "effort", value: "low" }],
  } as unknown as ModelSelection;
  const opus = { instanceId: "claudeAgent", model: "claude-opus-5-5" } as unknown as ModelSelection;

  it.each([
    ["the line it writes", `# Plan\n\n${sprintThreadModelLine(sonnet)}\n`, sonnet],
    ["bold, without backticks", `**Thread model:** ${JSON.stringify(opus)}\n`, opus],
    ["the not-set note", `${sprintThreadModelLine(null)}\n`, null],
    ["JSON that is not a selection", 'Thread model: `{"model":3}`\n', null],
    ["broken JSON", "Thread model: `{nope}`\n", null],
    ["no line", "# Plan\n\nPace: keep going\n", null],
  ])("reads %s", (_name, plan, expected) => {
    expect(parseSprintThreadModel(plan)).toEqual(expected);
  });

  it.each([
    [
      "rewrites the line and keeps the rest",
      "# Plan\n\nGoal: Ship\n\nPace: keep going\nThread model: not set.\n\n## Phases\n",
      `# Plan\n\nGoal: Ship\n\nPace: keep going\n${sprintThreadModelLine(opus)}\n\n## Phases\n`,
    ],
    [
      "puts one back after Pace",
      "# Plan\n\nGoal: Ship\n\nPace: keep going\n\n## Phases\n",
      `# Plan\n\nGoal: Ship\n\nPace: keep going\n${sprintThreadModelLine(opus)}\n\n## Phases\n`,
    ],
    [
      "or after the goal",
      "# Plan\n\nGoal: Ship\n",
      `# Plan\n\nGoal: Ship\n\n${sprintThreadModelLine(opus)}\n`,
    ],
  ])("%s", (_name, plan, expected) => {
    expect(withSprintThreadModel(plan, opus)).toBe(expected);
    expect(parseSprintThreadModel(withSprintThreadModel(plan, opus))).toEqual(opus);
  });
});
