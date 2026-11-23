import { describe, expect, it } from "vite-plus/test";

import { no3ySubagentSpec } from "./no3ySubagentCard";

describe("no3y subagent card", () => {
  it("names the model and effort, else the status", () => {
    expect(
      no3ySubagentSpec({ modelLabel: "Opus 5.5", effort: "High", statusLabel: "Working" }),
    ).toBe("Opus 5.5 · High");
    expect(
      no3ySubagentSpec({ modelLabel: "Not reported", effort: null, statusLabel: "Working" }),
    ).toBe("Working");
  });
});
