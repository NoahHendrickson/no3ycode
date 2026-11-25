import { describe, expect, it } from "vite-plus/test";

import {
  no3yQueueAutoScroll,
  no3yQueueDrop,
  no3yQueueDropIndex,
  no3yQueueRowShift,
  no3yQueueShownRuns,
} from "./no3yQueuedRuns";

describe("no3y queued banner reorder", () => {
  const ids = ["a", "b", "c"];

  it("drops a row into any slot, and sends the run it now sits before", () => {
    expect(no3yQueueDrop(ids, 2, 0)).toEqual({
      move: { runId: "c", beforeRunId: "a" },
      order: ["c", "a", "b"],
    });
    expect(no3yQueueDrop(ids, 0, 2)).toEqual({
      move: { runId: "a", beforeRunId: null },
      order: ["b", "c", "a"],
    });
    // One place up or down, as Move up / Move down send it.
    expect(no3yQueueDrop(ids, 1, 0)?.move).toEqual({ runId: "b", beforeRunId: "a" });
    expect(no3yQueueDrop(ids, 1, 2)?.move).toEqual({ runId: "b", beforeRunId: null });
    expect(no3yQueueDrop(ids, 1, 1)).toBeNull();
    expect(no3yQueueDrop(ids, 0, -1)).toBeNull();
    expect(no3yQueueDrop(ids, 2, 3)).toBeNull();
  });

  it("lands a drag on the nearest slot, clamped to the list", () => {
    expect(no3yQueueDropIndex(0, 21, 44, 3)).toBe(0);
    expect(no3yQueueDropIndex(0, 23, 44, 3)).toBe(1);
    expect(no3yQueueDropIndex(2, -100, 44, 3)).toBe(0);
    expect(no3yQueueDropIndex(0, 500, 44, 3)).toBe(2);
  });

  it("steps the rows between the lifted row and its slot aside, toward the gap it left", () => {
    // Row 0 held over slot 2: rows 1 and 2 rise into the gap.
    expect([0, 1, 2].map((index) => no3yQueueRowShift(index, 0, 2, 44))).toEqual([0, -44, -44]);
    // Row 2 held over slot 0: rows 0 and 1 drop down.
    expect([0, 1, 2].map((index) => no3yQueueRowShift(index, 2, 0, 44))).toEqual([44, 44, 0]);
    expect([0, 1, 2].map((index) => no3yQueueRowShift(index, -1, 0, 44))).toEqual([0, 0, 0]);
  });

  it("shows rows in a dropped order until the server's order changes from the one it replaced", () => {
    const rows = ids.map((id) => ({ id }));
    const idOf = (row: { id: string }) => row.id;
    const pending = { order: ["b", "a", "c"], base: ids };
    expect(no3yQueueShownRuns(rows, idOf, pending)?.map(idOf)).toEqual(["b", "a", "c"]);
    expect(no3yQueueShownRuns([{ id: "b" }, { id: "a" }, { id: "c" }], idOf, pending)).toBeNull();
    expect(no3yQueueShownRuns([{ id: "a" }, { id: "b" }], idOf, pending)).toBeNull();
    expect(no3yQueueShownRuns(rows, idOf, null)).toBeNull();
  });

  it("scrolls a long queue toward the edge a lifted row presses into, and stops at its ends", () => {
    // Six 44pt rows in a 198pt viewport: up to 66pt of scroll.
    const scrollAt = (rowTop: number, scroll: number) =>
      no3yQueueAutoScroll(rowTop, 44, 198, scroll, 264);
    expect(scrollAt(80, 30)).toBe(30);
    expect(scrollAt(150, 30)).toBeGreaterThan(30);
    expect(scrollAt(-20, 30)).toBe(22);
    expect(scrollAt(-20, 4)).toBe(0);
    expect(scrollAt(190, 64)).toBe(66);
    // A queue that fits never scrolls.
    expect(no3yQueueAutoScroll(-20, 44, 198, 0, 132)).toBe(0);
  });
});
