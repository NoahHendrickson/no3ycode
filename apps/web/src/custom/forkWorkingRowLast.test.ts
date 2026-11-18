import { describe, expect, it } from "vite-plus/test";
import type { MessagesTimelineRow } from "~/components/chat/MessagesTimeline.logic";
import { forkLiveStatusRows, forkStatusLineLiveRow } from "./forkWorkingRowLast";

type Working = Extract<MessagesTimelineRow, { kind: "working" }>;

const row = (kind: string, id: string, extra: object = {}) =>
  ({ kind, id, ...extra }) as MessagesTimelineRow;
const working = () => row("working", "working-indicator-row") as Working;
const liveTool = (extra: object = {}, entry: object = {}) =>
  row("work-live", "tool", {
    active: true,
    expanded: false,
    groupId: "g",
    entry: { id: "e", itemType: "command_execution", toolLifecycleStatus: "inProgress", ...entry },
    ...extra,
  });

const ids = (rows: MessagesTimelineRow[]) => rows.map((r) => r.id);
const statusLine = (rows: MessagesTimelineRow[]) => rows.at(-1) as Working;

describe("forkLiveStatusRows", () => {
  it("moves the turn-head working row below the streaming turn", () => {
    const rows = [row("message", "user"), working(), row("message", "answer")];
    expect(ids(forkLiveStatusRows(rows))).toEqual(["user", "answer", "working-indicator-row"]);
    expect(forkStatusLineLiveRow(statusLine(forkLiveStatusRows(rows)))).toBeUndefined();
  });

  it.each([
    ["the thinking line", row("thinking", "live")],
    ["a running tool", liveTool()],
  ])("folds %s into the status line", (_, live) => {
    const rows = [row("message", "user"), working(), row("message", "answer"), live];
    const result = forkLiveStatusRows(rows);
    expect(ids(result)).toEqual(["user", "answer", "working-indicator-row"]);
    expect(forkStatusLineLiveRow(statusLine(result))).toBe(live);
  });

  it.each([
    [
      "an open group's details",
      liveTool({ expanded: true }),
      "work",
      { isExpandedToolGroup: true },
    ],
    ["a group's viewed images", liveTool(), "viewed-images", {}],
  ])("folds past %s, leaving them above the line", (_, live, kind, extra) => {
    const trailing = row(kind, `g:${kind}`, extra);
    const result = forkLiveStatusRows([working(), live, trailing]);
    expect(ids(result)).toEqual([trailing.id, "working-indicator-row"]);
    expect(forkStatusLineLiveRow(statusLine(result))).toBe(live);
  });

  it.each([
    ["failed", liveTool({}, { toolLifecycleStatus: "failed" })],
    ["an approval", liveTool({}, { projectedItem: { item: { type: "approval_request" } } })],
  ])("keeps a %s live row on its own line", (_, live) => {
    const rows = [working(), live];
    expect(ids(forkLiveStatusRows(rows))).toEqual(["tool", "working-indicator-row"]);
  });

  it("keeps row identity while the stable rows are unchanged", () => {
    const work = working();
    const live = row("thinking", "live");
    const rows = [work, live];
    expect(forkLiveStatusRows(rows)).toBe(forkLiveStatusRows(rows));
    // A new stable array around the same rows reuses the merged row, so its frame skips a render.
    expect(statusLine(forkLiveStatusRows([work, live]))).toBe(statusLine(forkLiveStatusRows(rows)));
    // A changed live row yields a new merged row, so the line re-renders.
    const next = row("thinking", "live", { expanded: false });
    expect(statusLine(forkLiveStatusRows([work, next]))).not.toBe(
      statusLine(forkLiveStatusRows(rows)),
    );
    const idle = [row("message", "answer")];
    expect(forkLiveStatusRows(idle)).toBe(idle);
  });
});
