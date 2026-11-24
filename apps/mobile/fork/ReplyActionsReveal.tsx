/**
 * A reply's actions grow in as its turn ends — see `.fork/customizations.yaml#mobile-feed-stable-end`.
 * At full height in one frame they jumped the end-pinned feed; growing in, they ride with the
 * status space that eases away at the same moment.
 */

import { useEffect, useState, type ReactNode } from "react";
import Animated from "react-native-reanimated";

export const REPLY_ACTIONS_TOP_GAP = 4;
const REPLY_ACTIONS_REVEAL_MS = 180;

export function ReplyActionsReveal(props: {
  /** Read once at mount: rows that mount with their actions (history, a reopened thread) show them as-is. */
  readonly reveal: boolean;
  readonly height: number;
  readonly children: ReactNode;
}) {
  const [reveal] = useState(props.reveal);
  const [grown, setGrown] = useState(!reveal);
  // Starts the native height transition once the collapsed frame has committed.
  useEffect(() => {
    if (grown) return;
    const frame = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(frame);
  }, [grown]);
  if (!reveal) return props.children;
  return (
    <Animated.View
      style={{
        height: grown ? props.height : 0,
        opacity: grown ? 1 : 0,
        overflow: "hidden",
        transitionProperty: ["height", "opacity"],
        transitionDuration: REPLY_ACTIONS_REVEAL_MS,
        transitionTimingFunction: "ease-out",
      }}
    >
      {props.children}
    </Animated.View>
  );
}
