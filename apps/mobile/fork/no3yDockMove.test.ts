import { describe, expect, it } from "vite-plus/test";

import { no3yDockDirection } from "./no3yDockMove";

describe("no3y dock motion", () => {
  it("slides by dock order: right is +1, left is -1, anything else does not move", () => {
    expect(no3yDockDirection("threads", "chat")).toBe(1);
    expect(no3yDockDirection("automations", "newAgent")).toBe(-1);
    expect(no3yDockDirection("chat", "threads")).toBe(-1);
    expect(no3yDockDirection("chat", "chat")).toBe(0);
    expect(no3yDockDirection("settings", "chat")).toBe(0);
    expect(no3yDockDirection(null, "threads")).toBe(0);
  });
});
