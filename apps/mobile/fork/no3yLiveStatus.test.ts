import { describe, expect, it } from "vite-plus/test";

import {
  NO3Y_LIVE_ROW_ID,
  no3yDropLiveFold,
  no3yLiveRowLast,
  no3ySplitLiveTool,
  no3yTurnTimerLabel,
} from "./no3yLiveStatus";

describe("no3y live status line", () => {
  it("moves the live row to the end, leaving everything else in order", () => {
    const rows = [{ id: "a" }, { id: NO3Y_LIVE_ROW_ID }, { id: "b" }, { id: "c" }];
    expect(no3yLiveRowLast(rows).map((row) => row.id)).toEqual(["a", "b", "c", NO3Y_LIVE_ROW_ID]);
    // The same derived rows give the same reordered array, so the list sees no new data.
    expect(no3yLiveRowLast(rows)).toBe(no3yLiveRowLast(rows));
  });

  it("returns the same rows when the live row is already last or absent", () => {
    const last = [{ id: "a" }, { id: NO3Y_LIVE_ROW_ID }];
    const none = [{ id: "a" }];
    expect(no3yLiveRowLast(last)).toBe(last);
    expect(no3yLiveRowLast(none)).toBe(none);
  });

  it("drops only the live fold row, keeping a settled one", () => {
    const rows = [
      { id: "settled", type: "run-fold" },
      { id: "live", type: "run-fold", workingSince: "2026-11-22T00:00:00.000Z" },
      { id: NO3Y_LIVE_ROW_ID, type: "thinking" },
    ];
    expect(no3yDropLiveFold(rows).map((row) => row.id)).toEqual(["settled", NO3Y_LIVE_ROW_ID]);
    expect(no3yDropLiveFold(rows)).toBe(no3yDropLiveFold(rows));
    const settled = rows.slice(0, 1);
    expect(no3yDropLiveFold(settled)).toBe(settled);
  });

  it("splits a running tool out of the live row and puts Thinking below it", () => {
    const start = "2026-11-22T00:00:00.000Z";
    type Row = {
      id: string;
      type: string;
      groupId?: string;
      activities?: Array<{ groupStandIn: { groupId: string } }>;
    };
    const thinking = (): Row => ({ id: NO3Y_LIVE_ROW_ID, type: "thinking" });
    const lone: Row[] = [
      { id: "reply", type: "message" },
      {
        id: NO3Y_LIVE_ROW_ID,
        type: "activity-group",
        activities: [{ groupStandIn: { groupId: "g1" } }],
      },
    ];
    const split = no3ySplitLiveTool(lone, start, thinking);
    expect(split.map((row) => [row.id, row.type])).toEqual([
      ["reply", "message"],
      ["work-live:g1", "activity-group"],
      [NO3Y_LIVE_ROW_ID, "thinking"],
    ]);
    expect(no3ySplitLiveTool(lone, start, thinking)).toBe(split);
    const group: Row[] = [{ id: NO3Y_LIVE_ROW_ID, type: "work-toggle", groupId: "g2" }];
    expect(no3ySplitLiveTool(group, start, thinking).map((row) => row.id)).toEqual([
      "work-live:g2",
      NO3Y_LIVE_ROW_ID,
    ]);
    const alreadyThinking: Row[] = [{ id: NO3Y_LIVE_ROW_ID, type: "thinking" }];
    expect(no3ySplitLiveTool(alreadyThinking, start, thinking)).toBe(alreadyThinking);
    expect(no3ySplitLiveTool(lone, null, thinking)).toBe(lone);
  });

  it("formats the turn timer", () => {
    const start = "2026-11-22T00:00:00.000Z";
    const at = (seconds: number) => no3yTurnTimerLabel(start, Date.parse(start) + seconds * 1_000);
    expect([at(42), at(185), at(3_720)]).toEqual(["42s", "3m 05s", "1h 02m"]);
  });
});
