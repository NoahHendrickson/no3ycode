import { describe, expect, it } from "vite-plus/test";
import type { MessagesTimelineRow } from "~/components/chat/MessagesTimeline.logic";
import { forkSpaceTranscript, forkTranscriptGapStyle } from "./forkTranscriptSpacing";

const row = (fields: object) => fields as unknown as MessagesTimelineRow;
const reply = (showAssistantMeta = false) =>
  row({ kind: "message", id: "reply", message: { role: "assistant" }, showAssistantMeta });
const user = row({ kind: "message", id: "user", message: { role: "user" } });
const sent = row({ kind: "sent-message", id: "sent" });
const tool = (continuesWorkLog = false) => row({ kind: "work-live", id: "tool", continuesWorkLog });
const images = row({ kind: "viewed-images", id: "images" });
const live = row({ kind: "working", id: "working" });

const gaps = (rows: MessagesTimelineRow[]) =>
  forkSpaceTranscript(rows).map((row) => forkTranscriptGapStyle(row)?.paddingTop ?? 0);

describe("forkSpaceTranscript gaps", () => {
  it.each([
    ["a tool row under reply text", [reply(), tool()], [0, 12]],
    ["reply text under a tool row", [tool(), reply()], [0, 12]],
    ["a sent message under a tool row", [tool(), sent], [0, 12]],
    ["a tool row under a reply that already shows its meta", [reply(true), tool()], [0, 4]],
    ["the live line under a tool row", [tool(), live], [0, 10]],
    ["the live line under a tool row that continued", [tool(true), live], [0, 18]],
    ["the live line under reply text", [reply(), live], [0, 10]],
    ["the live line under viewed images", [images, live], [0, 12]],
    ["a reply under a user message", [user, reply()], [0, 0]],
  ])("tops up %s to 24px", (_, rows, expected) => {
    expect(gaps(rows)).toEqual(expected);
  });
});

describe("forkSpaceTranscript", () => {
  it("copies only the rows that gain a gap, and keeps the copies while it holds", () => {
    const rows = [reply(), tool()];
    const spaced = forkSpaceTranscript(rows);
    expect(spaced[0]).toBe(rows[0]);
    expect(spaced[1]).not.toBe(rows[1]);
    expect(forkTranscriptGapStyle(spaced[1]!)).toEqual({ paddingTop: 12 });
    expect(forkSpaceTranscript([...rows])[1]).toBe(spaced[1]);
  });

  it("hands over a fresh copy when a row's gap changes, and the bare row when it goes", () => {
    const first = forkSpaceTranscript([tool(), live])[1]!;
    const moved = forkSpaceTranscript([tool(true), live])[1]!;
    expect(forkTranscriptGapStyle(first)).toEqual({ paddingTop: 10 });
    expect(moved).not.toBe(first);
    expect(forkTranscriptGapStyle(moved)).toEqual({ paddingTop: 18 });
    expect(forkSpaceTranscript([live])[0]).toBe(live);
  });

  it("returns the same array when no row needs a gap", () => {
    const rows = [user, reply()];
    expect(forkSpaceTranscript(rows)).toBe(rows);
  });
});
