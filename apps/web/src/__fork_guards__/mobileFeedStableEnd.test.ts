// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#mobile-feed-stable-end`. The policy itself is a
 * truth table in `apps/mobile/fork/threadFeedStableEnd.test.ts`; this checks the screens use it.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const read = (path: string) =>
  NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(path, import.meta.url)), "utf8");
const feed = read("../../../mobile/src/features/threads/ThreadFeed.tsx");
const detail = read("../../../mobile/src/features/threads/ThreadDetailScreen.tsx");

describe("mobile-feed-stable-end", () => {
  it("drives end following and anchoring from the fork policy", () => {
    expect(feed).toContain("resolveFeedEndBehavior({");
    expect(feed).toContain("maintainScrollAtEnd={endBehavior.maintainScrollAtEnd}");
    expect(feed).toContain(
      "maintainVisibleContentPosition={endBehavior.maintainVisibleContentPosition}",
    );
    expect(feed).toContain("useFeedFollowingEnd(");
    expect(feed).toContain("keyboardLiftBehavior={endBehavior.keyboardLiftBehavior}");
    expect(feed).toContain("sendingWithKeyboard: props.sendingWithKeyboard ?? false,");
  });

  it("gives rows landing at the end their own estimate buckets", () => {
    expect(feed).toContain("return NO3Y_LIVE_ROW_TYPE;");
    expect(feed).toContain("streamingReplyItemType(FEED_STABLE_END, entry.message)");
  });

  it("grows a reply's actions in as its turn ends", () => {
    expect(feed).toContain("<ReplyActionsReveal");
    expect(feed).toContain("endBehavior.revealReplyActions");
  });

  it("keeps the keyboard up after sending a follow-up", () => {
    expect(detail).toContain("keepingKeyboard = true;");
    expect(detail).toContain("if (!dismissingKeyboard && !keepingKeyboard)");
  });
});
