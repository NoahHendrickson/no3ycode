import { describe, expect, it } from "vite-plus/test";

import type { PendingThreadFeedEntry } from "../src/features/threads/pending-thread-feed";

import {
  NO3Y_LIVE_ROW_ID,
  no3yLivePresentation,
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

  it("returns the same rows when the live row is already last or absent", () => {
    const last = [{ id: "a" }, { id: NO3Y_LIVE_ROW_ID }];
    const none = [{ id: "a" }];
    expect(no3yLiveRowLast(last)).toBe(last);
    expect(no3yLiveRowLast(none)).toBe(none);
  });

  describe("live presentation", () => {
    const start = "2026-11-22T00:00:00.000Z";
    // Rows carry only the fields the live presentation reads.
    const row = (fields: Record<string, unknown>) => fields as unknown as PendingThreadFeedEntry;
    const toggle = (fields: Record<string, unknown>) =>
      row({
        type: "work-toggle",
        id: NO3Y_LIVE_ROW_ID,
        groupId: "g",
        summaryKind: "command",
        shimmer: true,
        runId: "r",
        ...fields,
      });
    const ids = (rows: ReadonlyArray<{ readonly id: string }>) => rows.map((entry) => entry.id);

    it("drops the live fold and the pending placeholder unless the fold hosts setup", () => {
      const rows = [
        row({ type: "run-fold", id: "settled" }),
        row({ type: "run-fold", id: "live", workingSince: start }),
        { type: "pending-fold" as const, id: "pending", createdAt: start, messageId: "m" },
      ];
      expect(ids(no3yLivePresentation(rows, { startedAt: start, keepLiveFold: false }))).toEqual([
        "settled",
      ]);
      expect(ids(no3yLivePresentation(rows, { startedAt: start, keepLiveFold: true }))).toEqual([
        "settled",
        "live",
      ]);
    });

    it("keeps a running tool as a row with Thinking right below it, above queued messages", () => {
      const rows = [
        row({ type: "message", id: "reply" }),
        toggle({}),
        row({ type: "message", id: "queued" }),
      ];
      const presented = no3yLivePresentation(rows, { startedAt: start, keepLiveFold: false });
      expect(presented.map((entry) => [entry.id, entry.type])).toEqual([
        ["reply", "message"],
        ["work-live:g", "work-toggle"],
        [NO3Y_LIVE_ROW_ID, "thinking"],
        ["queued", "message"],
      ]);
      // The status line animates; the tool row above it stops shimmering.
      expect(presented[1]).toMatchObject({ shimmer: false });
      expect(presented[2]).toMatchObject({ createdAt: start, runId: "r" });
      expect(no3yLivePresentation(rows, { startedAt: start, keepLiveFold: false })).toBe(presented);
    });

    it("leaves live reasoning, a thinking row, or an idle feed as the one status line", () => {
      const input = { startedAt: start, keepLiveFold: false };
      const reasoning = [toggle({ summaryKind: "reasoning" })];
      expect(no3yLivePresentation(reasoning, input)).toEqual(reasoning);
      const thinking = [row({ type: "thinking", id: NO3Y_LIVE_ROW_ID })];
      expect(no3yLivePresentation(thinking, input)).toEqual(thinking);
      expect(no3yLivePresentation(thinking, input)).toBe(no3yLivePresentation(thinking, input));
      const idle = [toggle({})];
      expect(no3yLivePresentation(idle, { startedAt: null, keepLiveFold: false })).toBe(idle);
    });

    it("seeds the thinking word from the row above, holding until a new row or step lands", () => {
      const input = { startedAt: start, keepLiveFold: false };
      const thinking = row({ type: "thinking", id: NO3Y_LIVE_ROW_ID });
      const seed = (rows: PendingThreadFeedEntry[]) =>
        no3yLiveWordSeed(no3yLivePresentation(rows, input).at(-1)!);
      const reply = row({ type: "message", id: "reply" });
      const first = no3yLivePresentation([reply, thinking], input).at(-1);
      // Re-derived rows with the same row above keep the same live row, so it doesn't re-render.
      expect(no3yLivePresentation([reply, thinking], input).at(-1)).toBe(first);
      expect(seed([reply, thinking])).toBe("reply");
      expect(seed([reply, row({ type: "message", id: "next" }), thinking])).toBe("next");
      // Live reasoning seeds from its own group, so each new step moves the word.
      expect(seed([toggle({ summaryKind: "reasoning", hiddenCount: 1 })])).not.toBe(
        seed([toggle({ summaryKind: "reasoning", hiddenCount: 2 })]),
      );
    });

    it("keeps a lone tool shimmering only while it runs", () => {
      const lone = (lifecycleStatus: string) =>
        row({
          type: "activity-group",
          id: NO3Y_LIVE_ROW_ID,
          runId: "r",
          activities: [{ live: true, lifecycleStatus, groupStandIn: { groupId: "g" } }],
        });
      for (const [status, live] of [
        ["inProgress", true],
        ["completed", false],
      ] as const) {
        const [tool] = no3yLivePresentation([lone(status)], {
          startedAt: start,
          keepLiveFold: false,
        });
        expect(tool).toMatchObject({ id: "work-live:g", activities: [{ live }] });
      }
    });
  });

  it("formats the turn timer", () => {
    const start = "2026-11-22T00:00:00.000Z";
    const at = (seconds: number) => no3yTurnTimerLabel(start, Date.parse(start) + seconds * 1_000);
    expect([at(42), at(185), at(3_720)]).toEqual(["42s", "3m 05s", "1h 02m"]);
  });
});
