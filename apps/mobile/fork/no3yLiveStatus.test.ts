import { describe, expect, it } from "vite-plus/test";

import {
  NO3Y_LIVE_ROW_ID,
  no3yLiveRowLast,
  no3yLiveWordSeed,
  no3yTurnTimerLabel,
} from "./no3yLiveStatus";

describe("no3y live status line", () => {
  it("moves the live row to the end, leaving everything else in order", () => {
    const rows = [{ id: "a" }, { id: NO3Y_LIVE_ROW_ID }, { id: "b" }, { id: "c" }];
    expect(no3yLiveRowLast(rows).map((row) => row.id)).toEqual(["a", "b", "c", NO3Y_LIVE_ROW_ID]);
    // The same derived rows give the same reordered array, so the list sees no new data.
    expect(no3yLiveRowLast(rows)).toBe(no3yLiveRowLast(rows));
  });

  it("returns the same rows when the live row is absent", () => {
    const none = [{ id: "a" }];
    expect(no3yLiveRowLast(none)).toBe(none);
  });

  it("seeds the live row's word from the row above, holding until that row changes", () => {
    const live = { id: NO3Y_LIVE_ROW_ID };
    const seedAbove = (above: { id: string; activities?: unknown[] }) =>
      no3yLiveWordSeed(no3yLiveRowLast([above, live]).at(-1)!);
    const first = no3yLiveRowLast([{ id: "a" }, live]).at(-1)!;
    // Re-derived rows with the same row above keep the same live row, so it doesn't re-render.
    expect(no3yLiveRowLast([{ id: "a" }, live]).at(-1)).toBe(first);
    expect(no3yLiveWordSeed(first)).toBe("a");
    expect(seedAbove({ id: "group", activities: [1] })).not.toBe(
      seedAbove({ id: "group", activities: [1, 2] }),
    );
  });

  it("formats the turn timer", () => {
    const start = "2026-11-22T00:00:00.000Z";
    const at = (seconds: number) => no3yTurnTimerLabel(start, Date.parse(start) + seconds * 1_000);
    expect([at(42), at(185), at(3_720)]).toEqual(["42s", "3m 05s", "1h 02m"]);
  });
});
