import { describe, expect, it } from "vite-plus/test";

import { no3ySubagentActivity, no3ySubagentSpec } from "./no3ySubagentCard";

describe("no3y subagent card", () => {
  it("shows live progress while working and the result once settled, never swapped", () => {
    const progress = "Running `vp test`";
    expect(no3ySubagentActivity({ active: true, progress, result: "Done" })).toEqual({
      label: "Now",
      text: "Running vp test",
      shape: "prose",
    });
    expect(no3ySubagentActivity({ active: false, progress, result: null })).toBeNull();
    expect(
      no3ySubagentActivity({
        active: false,
        progress: undefined,
        result: "Child task ended with status completed",
      }),
    ).toBeNull();
  });

  it("marks a bare path so it truncates in the middle", () => {
    expect(
      no3ySubagentActivity({
        active: true,
        progress: "/Users/noey/repo/apps/mobile/fork/x.ts",
        result: null,
      })?.shape,
    ).toBe("path");
  });

  it("names the model and effort, else the status", () => {
    expect(
      no3ySubagentSpec({ modelLabel: "Opus 5.5", effort: "High", statusLabel: "Working" }),
    ).toBe("Opus 5.5 · High");
    expect(
      no3ySubagentSpec({ modelLabel: "Not reported", effort: null, statusLabel: "Working" }),
    ).toBe("Working");
  });
});
