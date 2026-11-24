import { describe, expect, it } from "vite-plus/test";

import { THREAD_FEED_MAINTAIN_SCROLL_AT_END } from "../src/features/threads/threadFeedEndFollow";
import { isNo3yLiveRow, NO3Y_LIVE_ROW_ID } from "./no3yLiveStatus";
import { resolveFeedEndBehavior, streamingReplyItemType } from "./threadFeedStableEnd";

const glide = { ...THREAD_FEED_MAINTAIN_SCROLL_AT_END, animated: true };
const instant = THREAD_FEED_MAINTAIN_SCROLL_AT_END;

describe("resolveFeedEndBehavior", () => {
  // stableEnd, followingEnd, jumpReady, settling, reduceMotion → scrollAtEnd, anchoring, reveal, keyboard lift
  it.each([
    // iOS following its end: end following owns the position and glides; the keyboard always lifts.
    [true, true, false, false, false, glide, false, true, "always"],
    // Scrolled away: anchoring holds what the reader sees, and the keyboard lifts only at the end.
    [true, false, false, false, false, glide, true, true, "whenAtEnd"],
    // Landing on open stays instant; the feed is hidden until it reaches its end.
    [true, true, false, true, false, instant, false, false, "always"],
    // Reduce Motion follows instantly and pops the reply actions in.
    [true, true, false, false, true, instant, false, false, "always"],
    // A jump to a message owns the scroll: no end following, anchoring on.
    [true, true, true, false, false, false, true, true, "always"],
    // Android keeps upstream: anchoring always, instant end following, no reveal.
    [false, true, false, false, false, instant, true, false, "whenAtEnd"],
    [false, false, false, false, false, instant, true, false, "whenAtEnd"],
    [false, true, true, false, false, false, true, false, "whenAtEnd"],
  ] as const)(
    "stableEnd=%s following=%s jump=%s settling=%s reduceMotion=%s",
    (
      stableEnd,
      followingEnd,
      jumpReady,
      settling,
      reduceMotion,
      scrollAtEnd,
      anchoring,
      reveal,
      keyboardLift,
    ) => {
      const behavior = resolveFeedEndBehavior({
        stableEnd,
        followingEnd,
        jumpReady,
        settling,
        reduceMotion,
      });
      expect(behavior.maintainScrollAtEnd).toEqual(scrollAtEnd);
      expect(behavior.maintainVisibleContentPosition).toBe(anchoring);
      expect(behavior.revealReplyActions).toBe(reveal);
      expect(behavior.keyboardLiftBehavior).toBe(keyboardLift);
    },
  );
});

describe("row estimate types", () => {
  const reply = { id: "m1", role: "assistant", streaming: true };

  it("gives a streaming reply a type with no average on iOS only", () => {
    expect(streamingReplyItemType(true, reply)).toBe("message:assistant-streaming:m1");
    expect(streamingReplyItemType(true, { ...reply, id: "m2" })).not.toBe(
      streamingReplyItemType(true, reply),
    );
    expect(streamingReplyItemType(true, { ...reply, streaming: false })).toBeUndefined();
    expect(streamingReplyItemType(true, { ...reply, role: "user" })).toBeUndefined();
    expect(streamingReplyItemType(false, reply)).toBeUndefined();
  });

  it("recognizes the no3y live line", () => {
    expect(isNo3yLiveRow(true, { id: NO3Y_LIVE_ROW_ID })).toBe(true);
    expect(isNo3yLiveRow(false, { id: NO3Y_LIVE_ROW_ID })).toBe(false);
    expect(isNo3yLiveRow(true, { id: "message:m1" })).toBe(false);
  });
});
