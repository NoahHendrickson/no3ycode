/**
 * Drag-to-reorder for the no3y queued-messages banner (`.fork/customizations.yaml#fork-queued-runs-banner`):
 * the UI-thread drag state, the edge auto-scroll, each row's motion, and the leading grip.
 */
import GripVerticalIcon from "@hugeicons/core-free-icons/GripVerticalIcon";
import * as Haptics from "expo-haptics";
import { useLayoutEffect, useMemo } from "react";
import { type LayoutChangeEvent, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  ReduceMotion,
  scrollTo,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useScrollOffset,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import type { FlatGlassPalette } from "./flatGlassTheme";
import { HugeIcon } from "./HugeIcon";
import { no3yQueueAutoScroll, no3yQueueDropIndex, no3yQueueRowShift } from "./no3yQueuedRuns";

const SHIFT_TIMING = { duration: 160, reduceMotion: ReduceMotion.System } as const;
const SETTLE_TIMING = { duration: 140, reduceMotion: ReduceMotion.System } as const;

/** The row being dragged, shared by every row so the others can step aside on the UI thread. */
export type QueueDrag = {
  readonly from: SharedValue<number>;
  readonly to: SharedValue<number>;
  readonly y: SharedValue<number>;
  readonly rowHeight: SharedValue<number>;
  readonly count: SharedValue<number>;
  /** The finger's travel since the lift, before the list's own scrolling is added. */
  readonly translation: SharedValue<number>;
  readonly scroll: SharedValue<number>;
  readonly scrollAtLift: SharedValue<number>;
  /** The handler tag of the gesture holding a row, or -1. Released by its holder or by `release`. */
  readonly owner: SharedValue<number>;
  /** Bumped by every queue change; a drop carries the value from its lift and is void if it moved. */
  readonly version: SharedValue<number>;
  readonly liftVersion: SharedValue<number>;
};

/** One drag at a time over the queue's rows, keyed to the order on screen. */
export function useNo3yQueueDrag(runIds: ReadonlyArray<string>) {
  const from = useSharedValue(-1);
  const to = useSharedValue(-1);
  const y = useSharedValue(0);
  const rowHeight = useSharedValue(44);
  const count = useSharedValue(0);
  const translation = useSharedValue(0);
  const scrollAtLift = useSharedValue(0);
  const owner = useSharedValue(-1);
  const version = useSharedValue(0);
  const liftVersion = useSharedValue(0);
  const viewport = useSharedValue(0);
  const listRef = useAnimatedRef<Animated.ScrollView>();
  const scroll = useScrollOffset(listRef);
  const drag = useMemo<QueueDrag>(
    () => ({
      from,
      to,
      y,
      rowHeight,
      count,
      translation,
      scroll,
      scrollAtLift,
      owner,
      version,
      liftVersion,
    }),
    [from, to, y, rowHeight, count, translation, scroll, scrollAtLift, owner, version, liftVersion],
  );

  // Scrolls a long queue while the held row presses into an edge.
  const { setActive } = useFrameCallback(() => {
    // Stopping reaches the JS thread a frame late; a released row's settle must not be overwritten.
    if (owner.get() < 0) return;
    const height = rowHeight.get();
    const current = scroll.get();
    const next = no3yQueueAutoScroll(
      from.get() * height + y.get() - current,
      height,
      viewport.get(),
      current,
      count.get() * height,
    );
    if (next === current) return;
    scrollTo(listRef, 0, next, false);
    scroll.set(next);
    followFinger(drag);
  }, false);
  // The frame callback runs exactly while a row is held.
  useAnimatedReaction(
    () => owner.get() >= 0,
    (held, previous) => {
      if (held !== previous) scheduleOnRN(setActive, held);
    },
  );

  const release = () => {
    owner.set(-1);
    from.set(-1);
    to.set(-1);
    y.set(0);
  };

  const orderKey = runIds.join(" ");
  const rowCount = runIds.length;
  // A queue change re-slots every row. It voids a drag in flight, whose grip may have unmounted
  // without its gesture ending, and clears a drop's offsets in the commit that moves the row.
  useLayoutEffect(() => {
    count.set(rowCount);
    version.set(version.get() + 1);
    release();
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- orderKey is the trigger, not a value it reads
  }, [orderKey, rowCount, count, version, release]);

  const onListLayout = (event: LayoutChangeEvent) => {
    viewport.set(event.nativeEvent.layout.height);
    // Fires on mount and while the rows fit, both at the top; the offset only updates on scroll.
    scroll.set(0);
  };

  return { drag, listRef, onListLayout, release };
}

/** A row's motion: the lifted row rides the finger, the others step aside for it. */
export function useNo3yQueueRow(drag: QueueDrag, index: number, liftedFill: string) {
  const shift = useDerivedValue(() =>
    drag.from.get() < 0
      ? 0
      : withTiming(
          no3yQueueRowShift(index, drag.from.get(), drag.to.get(), drag.rowHeight.get()),
          SHIFT_TIMING,
        ),
  );
  const style = useAnimatedStyle(() => {
    const lifted = drag.from.get() === index;
    return {
      zIndex: lifted ? 1 : 0,
      backgroundColor: lifted ? liftedFill : "transparent",
      transform: [{ translateY: lifted ? drag.y.get() : shift.get() }],
    };
  });
  const onLayout = (event: LayoutChangeEvent) =>
    drag.rowHeight.set(event.nativeEvent.layout.height);
  return { style, onLayout };
}

function hapticTick() {
  void Haptics.selectionAsync();
}

/** Puts the lifted row under the finger, counting how far the list scrolled since the lift. */
function followFinger(drag: QueueDrag) {
  "worklet";
  const from = drag.from.get();
  const height = drag.rowHeight.get();
  const count = drag.count.get();
  const travel = drag.translation.get() + drag.scroll.get() - drag.scrollAtLift.get();
  // Held inside the list, which clips anything dragged past its ends.
  drag.y.set(Math.min((count - 1 - from) * height, Math.max(-from * height, travel)));
  const to = no3yQueueDropIndex(from, travel, height, count);
  if (to !== drag.to.get()) {
    drag.to.set(to);
    scheduleOnRN(hapticTick);
  }
}

/**
 * The leading drag handle. Its accessible shell matches SettingsDragHandle's, but the drag runs on
 * the UI thread, which neither that nor ThreadArrangementSheet's JS-thread handle supports. Holds
 * the header icon's column even with one message, so row text stays aligned under "Queued".
 */
export function QueueGrip(props: {
  readonly palette: FlatGlassPalette;
  readonly position: string;
  readonly index: number;
  readonly count: number;
  readonly enabled: boolean;
  readonly drag: QueueDrag;
  readonly onDrop: (from: number, to: number, version: number) => void;
  readonly onStep: (direction: "up" | "down") => void;
}) {
  const { drag, index, count, enabled, onDrop } = props;
  // Claims the touch before the queue's ScrollView can, so a drag never scrolls the list by hand.
  // oxlint-disable-next-line react/capitalized-calls -- Gesture.Pan is a gesture factory, not a React component.
  const gesture = Gesture.Pan()
    .enabled(enabled)
    .minDistance(0)
    .shouldCancelWhenOutside(false)
    .onStart((event) => {
      // One drag at a time: a second finger on another grip does nothing.
      if (drag.owner.get() >= 0) return;
      drag.owner.set(event.handlerTag);
      drag.liftVersion.set(drag.version.get());
      drag.y.set(0);
      drag.translation.set(0);
      drag.scrollAtLift.set(drag.scroll.get());
      drag.to.set(index);
      drag.from.set(index);
      scheduleOnRN(hapticTick);
    })
    .onUpdate((event) => {
      if (drag.owner.get() !== event.handlerTag) return;
      drag.translation.set(event.translationY);
      followFinger(drag);
    })
    .onFinalize((event, success) => {
      if (drag.owner.get() !== event.handlerTag) return;
      drag.owner.set(-1);
      const to = success ? drag.to.get() : index;
      const version = drag.liftVersion.get();
      drag.to.set(to);
      drag.y.set(
        // A queue change or another drag cuts the settle short; that drop is stale.
        withTiming((to - index) * drag.rowHeight.get(), SETTLE_TIMING, (finished) => {
          if (finished) scheduleOnRN(onDrop, index, to, version);
        }),
      );
    });
  if (count < 2) return <View style={{ width: 40, alignSelf: "stretch" }} />;
  return (
    <GestureDetector gesture={gesture}>
      <View
        collapsable={false}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Reorder ${props.position}`}
        accessibilityState={{ disabled: !enabled }}
        accessibilityActions={[
          ...(index > 0 ? [{ name: "decrement", label: "Move up" }] : []),
          ...(index < count - 1 ? [{ name: "increment", label: "Move down" }] : []),
        ]}
        onAccessibilityAction={({ nativeEvent }) => {
          if (!enabled) return;
          if (nativeEvent.actionName === "decrement" && index > 0) props.onStep("up");
          if (nativeEvent.actionName === "increment" && index < count - 1) props.onStep("down");
        }}
        style={{
          width: 40,
          paddingLeft: 8,
          alignSelf: "stretch",
          alignItems: "center",
          justifyContent: "center",
          opacity: enabled ? 1 : 0.35,
        }}
      >
        <HugeIcon icon={GripVerticalIcon} size={16} color={props.palette.faintInk} />
      </View>
    </GestureDetector>
  );
}
