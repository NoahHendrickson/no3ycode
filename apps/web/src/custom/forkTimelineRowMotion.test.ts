import { describe, expect, it } from "vite-plus/test";
import type { MessagesTimelineRow } from "~/components/chat/MessagesTimeline.logic";
import { createTimelineRowMotion, slideStartOffset } from "./forkTimelineRowMotion";

const message = (id: string) => ({ kind: "message", id }) as MessagesTimelineRow;
const work = (id: string) => ({ kind: "work-toggle", id }) as MessagesTimelineRow;
const details = (groupId: string) =>
  ({ kind: "work", id: `${groupId}:details`, isExpandedToolGroup: true }) as MessagesTimelineRow;
const live = { kind: "thinking", id: "live-activity-row" } as MessagesTimelineRow;

function primed(rows: MessagesTimelineRow[]) {
  const motion = createTimelineRowMotion();
  motion.observe(rows, "thread", true);
  return motion;
}

describe("createTimelineRowMotion", () => {
  it("keeps the thread's first rows still", () => {
    const motion = createTimelineRowMotion();
    motion.observe([], "thread", true);
    motion.observe([message("a"), live], "thread", true);
    expect(motion.takeEntrance("a")).toBe(false);
    expect(motion.takeEntrance(live.id)).toBe(false);
    expect(motion.insertedRecently()).toBe(false);
  });

  it("enters a response landing above the live line, once", () => {
    const motion = primed([message("a"), live]);
    motion.observe([message("a"), work("w"), message("b"), live], "thread", true);
    expect(motion.insertedRecently()).toBe(true);
    expect(motion.takeEntrance("b")).toBe(true);
    expect(motion.takeEntrance("b")).toBe(false);
    // The settled work row replaces the live line in place.
    expect(motion.takeEntrance("w")).toBe(false);
  });

  it("keeps prepended history still", () => {
    const motion = primed([message("b")]);
    motion.observe([message("a"), message("b")], "thread", true);
    expect(motion.takeEntrance("a")).toBe(false);
    expect(motion.insertedRecently()).toBe(false);
  });

  it("enters the live line again on the next turn", () => {
    const motion = primed([message("a")]);
    motion.observe([message("a"), live], "thread", true);
    expect(motion.takeEntrance(live.id)).toBe(true);
    motion.observe([message("a"), message("b")], "thread", true);
    motion.observe([message("a"), message("b"), message("c"), live], "thread", true);
    expect(motion.takeEntrance(live.id)).toBe(true);
  });

  it("sees past an expanded live group's details row", () => {
    const motion = primed([message("a"), live, details("g")]);
    motion.observe([message("a"), message("b"), live, details("g")], "thread", true);
    expect(motion.takeEntrance("b")).toBe(true);
    // Collapsing the group later does not replay anything.
    motion.observe([message("a"), message("b"), live], "thread", true);
    expect(motion.takeEntrance(live.id)).toBe(false);
  });

  it("enters commentary landing between a running tool and the status line", () => {
    const tool = { kind: "work-live", id: "tool", active: true } as MessagesTimelineRow;
    const working = { kind: "working", id: "working" } as MessagesTimelineRow;
    const motion = primed([message("a"), tool, working]);
    motion.observe([message("a"), tool, message("b"), working], "thread", true);
    expect(motion.takeEntrance("b")).toBe(true);
  });

  it("keeps a tool the status line carried still when a reply lands after it", () => {
    const tool = { kind: "work-live", id: "tool", active: true } as MessagesTimelineRow;
    const carrying = {
      kind: "working",
      id: "working",
      forkLive: tool,
      forkWordSeed: "",
    } as unknown as MessagesTimelineRow;
    const working = { kind: "working", id: "working" } as MessagesTimelineRow;
    const motion = primed([message("a"), carrying]);
    motion.observe([message("a"), tool, message("b"), working], "thread", true);
    expect(motion.takeEntrance("tool")).toBe(false);
    expect(motion.takeEntrance("b")).toBe(true);
  });

  it("records no insertion when the live tool finishes and is drawn settled", () => {
    const tool = {
      kind: "work-live",
      id: "live-activity-row",
      active: true,
    } as MessagesTimelineRow;
    const settled = { ...tool, active: false, forkSettled: true } as unknown as MessagesTimelineRow;
    const working = { kind: "working", id: "working" } as MessagesTimelineRow;
    const motion = primed([message("a"), tool, working]);
    motion.observe([message("a"), settled, working], "thread", true);
    expect(motion.insertedRecently()).toBe(false);
  });

  it("keeps the status line still when its folded group opens", () => {
    const working = { kind: "working", id: "working-indicator-row" } as MessagesTimelineRow;
    const openDetails = {
      kind: "work",
      id: "g:details",
      isExpandedToolGroup: true,
    } as MessagesTimelineRow;
    const motion = primed([message("a"), working]);
    motion.observe([message("a"), openDetails, working], "thread", true);
    expect(motion.insertedRecently()).toBe(false);
  });

  it("sees past the trailing working row and a details row before it", () => {
    const working = { kind: "working", id: "working-indicator-row" } as MessagesTimelineRow;
    const motion = primed([message("a"), live, details("g"), working]);
    motion.observe([message("a"), message("b"), live, details("g"), working], "thread", true);
    expect(motion.takeEntrance("b")).toBe(true);
    expect(motion.takeEntrance(working.id)).toBe(false);
    motion.observe([message("a"), message("b"), message("c"), live, working], "thread", true);
    expect(motion.takeEntrance(live.id)).toBe(false);
  });

  it("primes from the synced rows, not the snapshot shown while syncing", () => {
    const motion = createTimelineRowMotion();
    motion.observe([message("a")], "thread", false);
    motion.observe([message("a"), message("b"), live], "thread", true);
    expect(motion.takeEntrance("b")).toBe(false);
    expect(motion.insertedRecently()).toBe(false);
  });

  it("lands a large catch-up batch still", () => {
    const motion = primed([message("a")]);
    const caughtUp = Array.from({ length: 8 }, (_, index) => message(`m${index}`));
    motion.observe([message("a"), ...caughtUp, live], "thread", true);
    expect(motion.takeEntrance("m7")).toBe(false);
    expect(motion.insertedRecently()).toBe(false);
  });

  it("re-primes on a thread switch", () => {
    const motion = primed([message("a")]);
    motion.observe([message("x"), message("y")], "two", true);
    expect(motion.takeEntrance("y")).toBe(false);
  });
});

describe("slideStartOffset", () => {
  it("starts an insertion slide from the old slot", () => {
    expect(slideStartOffset(null, 90)).toBe(-90);
  });

  it("holds the drawn position through an upward correction mid-slide", () => {
    // top 100 → 190 starts at -90 (drawn at 100); LegendList then corrects
    // top to 140 before the slide has moved.
    expect(140 + slideStartOffset({ from: -90, progress: 0 }, -50)).toBe(100);
    // Halfway through, the line is drawn at 145 and stays there.
    expect(140 + slideStartOffset({ from: -90, progress: 0.5 }, -50)).toBe(145);
  });
});
