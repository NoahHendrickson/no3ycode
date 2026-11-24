/**
 * The iOS thread feed stays put while a turn streams — see
 * `.fork/customizations.yaml#mobile-feed-stable-end`. One policy: while the feed follows its end,
 * end following alone owns the scroll position, and whatever changes at the end glides there.
 * Android (stableEnd false) keeps upstream's anchoring, instant end following and item types.
 */

import type { LegendListRef } from "@legendapp/list/react-native";
import { useCallback, useSyncExternalStore } from "react";

import { THREAD_FEED_MAINTAIN_SCROLL_AT_END } from "../src/features/threads/threadFeedEndFollow";

const FEED_END_FOLLOW_GLIDE = { ...THREAD_FEED_MAINTAIN_SCROLL_AT_END, animated: true } as const;

export function resolveFeedEndBehavior(feed: {
  readonly stableEnd: boolean;
  readonly followingEnd: boolean;
  readonly jumpReady: boolean;
  /** Landing on open: the feed is hidden until it reaches its end, so that stays instant. */
  readonly settling: boolean;
  readonly reduceMotion: boolean;
}) {
  const glide = feed.stableEnd && !feed.settling && !feed.reduceMotion;
  return {
    maintainScrollAtEnd: feed.jumpReady
      ? (false as const)
      : glide
        ? FEED_END_FOLLOW_GLIDE
        : THREAD_FEED_MAINTAIN_SCROLL_AT_END,
    // Anchoring fights end following whenever a row lands at the end with a guessed size: its
    // correction moved the offset by hundreds of points and end following dragged it back.
    maintainVisibleContentPosition: !feed.stableEnd || !feed.followingEnd || feed.jumpReady,
    // A reply's actions appear as its turn ends; at full height in one frame they jumped the feed.
    revealReplyActions: glide,
    // The keyboard lifts content only within 20pt of the end, and a glide toward it is often
    // further: the composer covered the reply until end following caught up. Following, always lift.
    keyboardLiftBehavior:
      feed.stableEnd && feed.followingEnd ? ("always" as const) : ("whenAtEnd" as const),
  };
}

/**
 * LegendList 3.7.3 has no per-item size estimate: a new row starts at its type's average. A
 * streaming reply would inherit finished replies' (~500pt for a ~60pt first line), so it gets a
 * type of its own with no average, which falls back to `estimatedItemSize`.
 */
export function unaveragedItemType(messageId: string): string {
  return `message:assistant-streaming:${messageId}`;
}

export function streamingReplyItemType(
  stableEnd: boolean,
  message: { readonly id: string; readonly role: string; readonly streaming: boolean },
): string | undefined {
  return stableEnd && message.role === "assistant" && message.streaming
    ? unaveragedItemType(message.id)
    : undefined;
}

const unsubscribeNothing = () => {};

/** The list's own end-following flag, read as React state. `listShown` resubscribes once it mounts. */
export function useFeedFollowingEnd(
  listRef: { readonly current: LegendListRef | null },
  listShown: boolean,
): boolean {
  const subscribe = useCallback(
    (notify: () => void) =>
      listShown
        ? (listRef.current?.getState().listen("isFollowingEnd", notify) ?? unsubscribeNothing)
        : unsubscribeNothing,
    [listRef, listShown],
  );
  const read = () => listRef.current?.getState().isFollowingEnd ?? true;
  return useSyncExternalStore(subscribe, read, read);
}
