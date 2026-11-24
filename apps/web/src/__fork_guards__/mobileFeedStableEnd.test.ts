// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#mobile-feed-stable-end`. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const feed = NodeFS.readFileSync(
  NodeURL.fileURLToPath(
    new URL("../../../mobile/src/features/threads/ThreadFeed.tsx", import.meta.url),
  ),
  "utf8",
);

describe("mobile-feed-stable-end", () => {
  it("anchors visible content on iOS only while the reader is away from the end", () => {
    expect(feed).toContain('if (Platform.OS === "ios") setFollowingEnd(state.isFollowingEnd);');
    expect(feed).toContain(
      'maintainVisibleContentPosition={Platform.OS !== "ios" || !followingEnd || jumpReady}',
    );
  });

  it("glides to the end once landed, instantly while landing or under Reduce Motion", () => {
    expect(feed).toContain("{ ...THREAD_FEED_MAINTAIN_SCROLL_AT_END, animated: true }");
    expect(feed).toContain('Platform.OS === "ios" && !reduceMotion && !settling');
  });

  it("keeps new end rows off averages taken from unlike rows", () => {
    expect(feed).toContain(
      'if (Platform.OS === "ios" && no3yBubble && entry.id === NO3Y_LIVE_ROW_ID) {',
    );
    expect(feed).toContain('return "no3y-live";');
    expect(feed).toMatch(
      /Platform\.OS === "ios" &&\s+entry\.message\.role === "assistant" &&\s+entry\.message\.streaming\s+\) \{\s+return `message:assistant-streaming:\$\{entry\.message\.id\}`;/,
    );
  });
});
