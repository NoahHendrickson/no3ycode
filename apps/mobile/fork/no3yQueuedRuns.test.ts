import { describe, expect, it } from "vite-plus/test";

import { no3yQueueMove } from "./no3yQueuedRuns";

describe("no3y queued banner reorder", () => {
  const ids = ["a", "b", "c"];

  it("moves a row up before its predecessor, and not past the top", () => {
    expect(no3yQueueMove(ids, "b", "up")).toEqual({ runId: "b", beforeRunId: "a" });
    expect(no3yQueueMove(ids, "a", "up")).toBeNull();
  });

  it("moves a row down past its successor, to the end when that is last", () => {
    expect(no3yQueueMove(ids, "a", "down")).toEqual({ runId: "a", beforeRunId: "c" });
    expect(no3yQueueMove(ids, "b", "down")).toEqual({ runId: "b", beforeRunId: null });
    expect(no3yQueueMove(ids, "c", "down")).toBeNull();
    expect(no3yQueueMove(ids, "z", "down")).toBeNull();
  });
});
