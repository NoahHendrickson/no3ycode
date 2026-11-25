/**
 * The Mac fork's "Queued · N" banner on the no3y iPhone composer (`.fork/customizations.yaml#fork-queued-runs-banner`):
 * a collapsible glass card right above the composer card with one line per queued message, Send
 * now / Steer, Edit and Remove on each, a leading grip to drag a row to a new place, and Move up /
 * Move down in its long-press menu.
 */
import ArrowDown01Icon from "@hugeicons/core-free-icons/ArrowDown01Icon";
import ArrowUp01Icon from "@hugeicons/core-free-icons/ArrowUp01Icon";
import ArrowUp02Icon from "@hugeicons/core-free-icons/ArrowUp02Icon";
import Delete02Icon from "@hugeicons/core-free-icons/Delete02Icon";
import GripVerticalIcon from "@hugeicons/core-free-icons/GripVerticalIcon";
import LeftToRightListNumberIcon from "@hugeicons/core-free-icons/LeftToRightListNumberIcon";
import PencilEdit02Icon from "@hugeicons/core-free-icons/PencilEdit02Icon";
import { useAtomValue } from "@effect/atom-react";
import {
  makeQueuedRunsAtom,
  queuedRunEditBlockedReason,
} from "@t3tools/client-runtime/queued-run-edit";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentId, RunId, ThreadId } from "@t3tools/contracts";
import { Atom } from "effect/reactivity";
import * as Haptics from "expo-haptics";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  ReduceMotion,
  scrollTo,
  type SharedValue,
  useAnimatedRef,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useScrollOffset,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { AppText as Text } from "../src/components/ui/AppText";
import * as Dialog from "../src/components/ui/Dialog";
import { Menu } from "../src/components/ui/Menu";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import {
  buildCancelQueuedRunCommand,
  resolveThreadQueueRowControls,
} from "../src/features/threads/threadQueueControlPresentation";
import { scopedThreadKey } from "../src/lib/scopedEntities";
import { beginQueuedRunEdit, useQueuedRunEdit } from "../src/state/queued-run-edit";
import { environmentThreadDetails, threadEnvironment } from "../src/state/threads";
import { useAtomCommand } from "../src/state/use-atom-command";
import { flatGlassPalette, NO3Y_FONT, type FlatGlassPalette } from "./flatGlassTheme";
import { HugeIcon, type HugeIconData } from "./HugeIcon";
import { NO3Y_PANEL_MARGIN, No3yGlassLayer } from "./No3yGlass";
import { NO3Y_FADE_IN, NO3Y_FADE_OUT, NO3Y_GLASS_RISE_IN, NO3Y_LAYOUT } from "./no3yMotion";
import { no3yPromptStash, stashPromptText } from "./No3yPromptStashSheet";
import {
  no3yQueueAutoScroll,
  no3yQueueDrop,
  no3yQueueDropIndex,
  no3yQueuedSender,
  no3yQueueMove,
  no3yQueueRowShift,
  no3yQueueShownOrder,
} from "./no3yQueuedRuns";

const RADIUS = 22;

type RowAction = "steer" | "edit" | "remove" | "up" | "down" | "stash";

// Four and a half 44pt rows, so a cut-off row shows there is more.
const QUEUE_ROWS_MAX_HEIGHT = 44 * 4.5;
const SHIFT_TIMING = { duration: 160, reduceMotion: ReduceMotion.System } as const;
const SETTLE_TIMING = { duration: 140, reduceMotion: ReduceMotion.System } as const;

/** The row being dragged, shared by every row so the others can step aside on the UI thread. */
type QueueDrag = {
  readonly from: SharedValue<number>;
  readonly to: SharedValue<number>;
  readonly y: SharedValue<number>;
  readonly rowHeight: SharedValue<number>;
  readonly count: SharedValue<number>;
  /** The finger's travel since the lift, before the list's own scrolling is added. */
  readonly translation: SharedValue<number>;
  readonly scroll: SharedValue<number>;
  readonly scrollAtLift: SharedValue<number>;
  /**
   * The handler tag of the gesture holding a row, or -1. Set on the UI thread so auto-scroll stops
   * before the settle starts, and untouched by queue changes so the holder always releases it.
   */
  readonly owner: SharedValue<number>;
};

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

export function No3yQueuedRunsBanner(props: {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
}) {
  const target = { environmentId: props.environmentId, threadId: props.threadId };
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const workflow = useAtomValue(environmentThreadDetails.queueWorkflowAtom(target));
  const threadKey = scopedThreadKey(props.environmentId, props.threadId);
  const editing = useQueuedRunEdit(threadKey);
  const pendingRequests = useAtomValue(environmentThreadDetails.pendingRequestsAtom(target));
  const editBlockedReason = queuedRunEditBlockedReason({
    openQuestionCount: pendingRequests?.userInputs.length ?? 0,
  });
  const promote = useAtomCommand(threadEnvironment.promoteQueuedRun, "promote queued message");
  const cancel = useAtomCommand(threadEnvironment.cancelQueuedRun, "remove queued message");
  const resume = useAtomCommand(threadEnvironment.resumeThreadQueue, "resume queue");
  const reorder = useAtomCommand(threadEnvironment.reorderQueuedRun, "reorder queued message");
  const resumeHeldQueue = useAtomCommand(threadEnvironment.resumeThreadQueue, {
    label: "resume queue",
    reportFailure: false,
  });
  const [expanded, setExpanded] = useState(true);
  const [busyRunId, setBusyRunId] = useState<RunId | null>(null);
  const [resuming, setResuming] = useState(false);
  const busyRef = useRef(false);
  const [dropped, setDropped] = useState<{
    readonly order: ReadonlyArray<RunId>;
    readonly base: ReadonlyArray<RunId>;
  } | null>(null);
  const dragFrom = useSharedValue(-1);
  const dragTo = useSharedValue(-1);
  const dragY = useSharedValue(0);
  const rowHeight = useSharedValue(44);
  const dragCount = useSharedValue(0);
  const translation = useSharedValue(0);
  const scrollAtLift = useSharedValue(0);
  const owner = useSharedValue(-1);
  const viewport = useSharedValue(0);
  const listRef = useAnimatedRef<Animated.ScrollView>();
  const scroll = useScrollOffset(listRef);
  const drag = useMemo<QueueDrag>(
    () => ({
      from: dragFrom,
      to: dragTo,
      y: dragY,
      rowHeight,
      count: dragCount,
      translation,
      scroll,
      scrollAtLift,
      owner,
    }),
    [dragFrom, dragTo, dragY, rowHeight, dragCount, translation, scroll, scrollAtLift, owner],
  );
  // Runs only while a row is held: scrolls a long queue when the row presses into an edge.
  const autoScroll = useFrameCallback(() => {
    const from = dragFrom.get();
    if (from < 0 || owner.get() < 0) return;
    const height = rowHeight.get();
    const current = scroll.get();
    const next = no3yQueueAutoScroll(
      from * height + dragY.get() - current,
      height,
      viewport.get(),
      current,
      dragCount.get() * height,
    );
    if (next === current) return;
    scrollTo(listRef, 0, next, false);
    scroll.set(next);
    followFinger(drag);
  }, false);
  const setAutoScroll = (active: boolean) => autoScroll.setActive(active);
  const resetDrag = () => {
    dragFrom.set(-1);
    dragTo.set(-1);
    dragY.set(0);
  };
  const serverRuns = workflow?.queuedRuns ?? [];
  const serverIds = serverRuns.map(({ run }) => run.id);
  const shownOrder = no3yQueueShownOrder(serverIds, dropped);
  if (dropped !== null && shownOrder === null) setDropped(null);
  const queuedRuns =
    shownOrder === null
      ? serverRuns
      : shownOrder.flatMap((id) => serverRuns.filter(({ run }) => run.id === id));
  const runIds = queuedRuns.map(({ run }) => run.id);
  const orderKey = runIds.join(" ");
  // The order on screen, for a drop that reaches the JS thread after the queue changed under it.
  const shownOrderKey = useRef(orderKey);
  // Clears the UI-thread drag offsets in the commit that moves the dropped row, so it never flashes back.
  useLayoutEffect(() => {
    shownOrderKey.current = orderKey;
    dragCount.set(orderKey === "" ? 0 : orderKey.split(" ").length);
    dragFrom.set(-1);
    dragTo.set(-1);
    dragY.set(0);
    // A grip unmounted mid-drag may never see its gesture end, so the change releases the drag.
    owner.set(-1);
    autoScroll.setActive(false);
  }, [orderKey, shownOrderKey, dragCount, dragFrom, dragTo, dragY, owner, autoScroll]);
  if (queuedRuns.length === 0) return null;
  const canSend = workflow?.canPromoteToSteer === true || workflow?.canSendNow === true;
  const sendLabel = workflow?.canSendNow ? "Send now" : "Steer";

  const act = async (runId: RunId, action: RowAction) => {
    if (busyRef.current) return;
    const entry = queuedRuns.find(({ run }) => run.id === runId);
    if (entry === undefined) return;
    if (action === "edit") {
      if (editBlockedReason !== null) return;
      void Haptics.selectionAsync();
      beginQueuedRunEdit(
        threadKey,
        {
          runId,
          messageId: entry.messageId,
          originalText: entry.text,
          existingAttachments: entry.attachments,
          ...(entry.context ? { context: entry.context } : {}),
        },
        makeQueuedRunsAtom({
          threadId: props.threadId,
          snapshot: threadEnvironment.snapshotAtom(props.environmentId),
          detailStatus: environmentThreadDetails.statusAtom(target),
          runs: Atom.make(
            (get) => get(environmentThreadDetails.quietThreadAtom(target))?.projection.runs ?? null,
          ),
        }),
      );
      return;
    }
    busyRef.current = true;
    setBusyRunId(runId);
    void Haptics.selectionAsync();
    if (action === "remove") {
      await cancel(buildCancelQueuedRunCommand({ ...target, runId }));
    } else if (action === "stash") {
      // Written first and taken back if the run can't be removed, as the Mac's stashQueuedRun does.
      const id = stashPromptText(entry.text, null);
      const result = await cancel(buildCancelQueuedRunCommand({ ...target, runId }));
      if (result._tag === "Failure") no3yPromptStash.remove(id);
    } else if (action === "up" || action === "down") {
      const move = no3yQueueMove(runIds, runId, action);
      if (move !== null) await reorder({ ...target, input: { threadId: props.threadId, ...move } });
    } else if (workflow?.canSendNow) {
      // Starts a held queue with this message when the thread is idle.
      await resume({ ...target, input: { threadId: props.threadId, runId } });
    } else if (workflow?.activeRun && workflow.canPromoteToSteer) {
      await promote({
        ...target,
        input: {
          threadId: props.threadId,
          queuedRunId: runId,
          targetRunId: workflow.activeRun.id,
        },
      });
    }
    busyRef.current = false;
    setBusyRunId(null);
  };

  const drop = async (from: number, to: number) => {
    // A queue change already cleared this drag; its slots belong to the old order.
    if (shownOrderKey.current !== orderKey) return;
    const result = busyRef.current ? null : no3yQueueDrop(runIds, from, to);
    if (result === null) {
      resetDrag();
      return;
    }
    busyRef.current = true;
    setBusyRunId(result.move.runId);
    setDropped({ order: result.order, base: serverIds });
    const outcome = await reorder({
      ...target,
      input: { threadId: props.threadId, ...result.move },
    });
    if (outcome._tag === "Failure") setDropped(null);
    busyRef.current = false;
    setBusyRunId(null);
  };

  const resumeQueue = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setResuming(true);
    const result = await resumeHeldQueue({ ...target, input: { threadId: props.threadId } });
    busyRef.current = false;
    setResuming(false);
    if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
      const error = squashAtomCommandFailure(result);
      Dialog.alert("Could not resume queue", error instanceof Error ? error.message : "Try again.");
    }
  };

  return (
    <Animated.View
      entering={NO3Y_GLASS_RISE_IN}
      layout={NO3Y_LAYOUT}
      style={{ ...NO3Y_PANEL_MARGIN, borderRadius: RADIUS }}
    >
      <No3yGlassLayer radius={RADIUS} />
      <View style={{ flexDirection: "row", alignItems: "center", minHeight: 44 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${queuedRuns.length} queued message${queuedRuns.length === 1 ? "" : "s"}`}
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((value) => !value)}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingLeft: 16,
            paddingRight: 8,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <HugeIcon icon={LeftToRightListNumberIcon} size={16} color={palette.quietInk} />
          <Text style={{ flex: 1, fontSize: 14, ...NO3Y_FONT.medium, color: palette.quietInk }}>
            {workflow?.isHeld ? "Queue paused" : "Queued"}
            <Text style={{ color: palette.metaInk, fontVariant: ["tabular-nums"] }}>
              {` · ${queuedRuns.length}`}
            </Text>
          </Text>
          <HugeIcon
            icon={expanded ? ArrowDown01Icon : ArrowUp01Icon}
            size={14}
            color={palette.quietInk}
          />
        </Pressable>
        {workflow?.isHeld ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Resume queue"
            disabled={resuming || busyRunId !== null}
            hitSlop={8}
            onPress={() => void resumeQueue()}
            style={({ pressed }) => ({
              paddingHorizontal: 14,
              opacity: resuming ? 0.45 : pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ fontSize: 14, ...NO3Y_FONT.medium, color: palette.foreground }}>
              Resume
            </Text>
          </Pressable>
        ) : null}
      </View>
      {expanded ? (
        <Animated.View entering={NO3Y_FADE_IN} exiting={NO3Y_FADE_OUT}>
          {/* A long queue scrolls under its header, which stays reachable above the keyboard. */}
          <Animated.ScrollView
            ref={listRef}
            style={{ maxHeight: QUEUE_ROWS_MAX_HEIGHT }}
            bounces={false}
            keyboardShouldPersistTaps="handled"
            onLayout={(event) => {
              viewport.set(event.nativeEvent.layout.height);
              // Fires on mount and when the rows fit, both at the top; the offset only updates on scroll.
              scroll.set(0);
            }}
          >
            {queuedRuns.map(({ run, text, attachments, context, message }, index) => {
              const controls = resolveThreadQueueRowControls({
                busy: busyRunId !== null,
                // A fresh message starts its own turn: it may skip compaction, but not steer into one.
                canPromoteToSteer:
                  (workflow?.canPromoteToSteer ?? false) &&
                  (run.freshContext !== true || workflow?.promoteSkipsCompaction === true),
                canSendNow: workflow?.canSendNow ?? false,
                editBlocked: editBlockedReason !== null,
                isEditing: editing?.runId === run.id,
                isGuestMessage: context?.guest !== undefined,
                text,
              });
              const sender = no3yQueuedSender(message);
              const title =
                controls.displayText || (attachments.length > 0 ? "Attachments" : "Queued message");
              return (
                <QueuedRow
                  key={run.id}
                  palette={palette}
                  index={index}
                  count={queuedRuns.length}
                  title={title}
                  attachmentCount={controls.displayText ? attachments.length : 0}
                  sender={sender?.label ?? null}
                  isEditing={controls.isEditing}
                  canSend={canSend && controls.canSend}
                  showSend={canSend}
                  sendLabel={sendLabel}
                  canEdit={controls.canEdit}
                  editHint={editBlockedReason}
                  canRemove={controls.canDismiss}
                  // The stash keeps text only, and a guest's words are not the owner's to keep.
                  canStash={
                    controls.canDismiss &&
                    attachments.length === 0 &&
                    context?.guest === undefined &&
                    (context?.records.length ?? 0) === 0 &&
                    text.trim().length > 0
                  }
                  canReorder={busyRunId === null}
                  drag={drag}
                  onAutoScroll={setAutoScroll}
                  onDrop={(from, to) => void drop(from, to)}
                  onAction={(action) => void act(run.id, action)}
                />
              );
            })}
          </Animated.ScrollView>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function QueuedRow(props: {
  readonly palette: FlatGlassPalette;
  readonly index: number;
  readonly count: number;
  readonly title: string;
  readonly attachmentCount: number;
  readonly sender: string | null;
  readonly isEditing: boolean;
  readonly canSend: boolean;
  readonly showSend: boolean;
  readonly sendLabel: string;
  readonly canEdit: boolean;
  readonly editHint: string | null;
  readonly canRemove: boolean;
  readonly canStash: boolean;
  readonly canReorder: boolean;
  readonly drag: QueueDrag;
  readonly onAutoScroll: (active: boolean) => void;
  readonly onDrop: (from: number, to: number) => void;
  readonly onAction: (action: RowAction) => void;
}) {
  const { palette, drag, index } = props;
  const position = `queued message ${index + 1}`;
  const shift = useDerivedValue(() =>
    drag.from.get() < 0
      ? 0
      : withTiming(
          no3yQueueRowShift(index, drag.from.get(), drag.to.get(), drag.rowHeight.get()),
          SHIFT_TIMING,
        ),
  );
  const liftedFill = palette.panelFallback;
  const rowStyle = useAnimatedStyle(() => {
    const lifted = drag.from.get() === index;
    return {
      zIndex: lifted ? 1 : 0,
      backgroundColor: lifted ? liftedFill : "transparent",
      transform: [{ translateY: lifted ? drag.y.get() : shift.get() }],
    };
  });
  return (
    <Animated.View
      onLayout={(event) => {
        drag.rowHeight.set(event.nativeEvent.layout.height);
      }}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          minHeight: 44,
          paddingRight: 8,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: palette.hairline,
        },
        rowStyle,
      ]}
    >
      <QueueGrip
        palette={palette}
        position={position}
        index={index}
        count={props.count}
        enabled={props.canReorder}
        drag={drag}
        onAutoScroll={props.onAutoScroll}
        onDrop={props.onDrop}
        onStep={(direction) => props.onAction(direction)}
      />
      <Menu
        accessibilityLabel={`Actions for ${position}`}
        shouldOpenOnLongPress
        style={{ flex: 1 }}
        actions={[
          ...(props.showSend
            ? [
                {
                  id: "steer",
                  title: props.sendLabel,
                  attributes: { disabled: !props.canSend },
                  image: "arrow.up",
                },
              ]
            : []),
          { id: "edit", title: "Edit", attributes: { disabled: !props.canEdit }, image: "pencil" },
          ...(props.count > 1
            ? [
                {
                  id: "up",
                  title: "Move up",
                  attributes: { disabled: !props.canReorder || props.index === 0 },
                  image: "arrow.up.to.line",
                },
                {
                  id: "down",
                  title: "Move down",
                  attributes: { disabled: !props.canReorder || props.index === props.count - 1 },
                  image: "arrow.down.to.line",
                },
              ]
            : []),
          ...(props.canStash
            ? [{ id: "stash", title: "Move to stash", image: "tray.and.arrow.down" }]
            : []),
          {
            id: "remove",
            title: "Remove",
            attributes: { disabled: !props.canRemove, destructive: true },
            image: "trash",
          },
        ]}
        onPressAction={({ nativeEvent }) => props.onAction(nativeEvent.event as RowAction)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={props.sender ? `${props.sender}: ${props.title}` : props.title}
          accessibilityHint={
            props.canEdit
              ? "Opens this message in the composer for editing"
              : (props.editHint ?? undefined)
          }
          disabled={!props.canEdit}
          onPress={() => props.onAction("edit")}
          style={({ pressed }) => ({
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontSize: 15,
              color: props.isEditing ? palette.metaInk : palette.titleInk,
            }}
          >
            {props.sender ? (
              <Text style={{ ...NO3Y_FONT.medium, color: palette.quietInk }}>
                {`${props.sender}  `}
              </Text>
            ) : null}
            {props.title}
          </Text>
          {props.attachmentCount > 0 ? (
            <Text style={{ fontSize: 13, color: palette.metaInk }}>
              {`+${props.attachmentCount}`}
            </Text>
          ) : null}
          {props.isEditing ? (
            <Text style={{ fontSize: 13, ...NO3Y_FONT.medium, color: palette.metaInk }}>
              Editing
            </Text>
          ) : null}
        </Pressable>
      </Menu>
      {props.showSend ? (
        <RowButton
          palette={palette}
          icon={ArrowUp02Icon}
          label={`${props.sendLabel}, ${position}`}
          disabled={!props.canSend}
          onPress={() => props.onAction("steer")}
        />
      ) : null}
      <RowButton
        palette={palette}
        icon={PencilEdit02Icon}
        label={`Edit ${position}`}
        disabled={!props.canEdit}
        onPress={() => props.onAction("edit")}
      />
      <RowButton
        palette={palette}
        icon={Delete02Icon}
        label={`Remove ${position}`}
        disabled={!props.canRemove}
        onPress={() => props.onAction("remove")}
      />
    </Animated.View>
  );
}

function hapticTick() {
  void Haptics.selectionAsync();
}

/**
 * The leading drag handle: the row follows the finger on the UI thread, the rows it passes step
 * aside, and the drop settles into its slot before the new order renders. Holds the header icon's
 * column even with one message, so row text stays aligned under "Queued".
 */
function QueueGrip(props: {
  readonly palette: FlatGlassPalette;
  readonly position: string;
  readonly index: number;
  readonly count: number;
  readonly enabled: boolean;
  readonly drag: QueueDrag;
  readonly onAutoScroll: (active: boolean) => void;
  readonly onDrop: (from: number, to: number) => void;
  readonly onStep: (direction: "up" | "down") => void;
}) {
  const { drag, index, count, enabled, onAutoScroll, onDrop } = props;
  // Claims the touch before the queue's ScrollView can, so a drag never scrolls the list.
  // oxlint-disable-next-line react/capitalized-calls -- Gesture.Pan is a gesture factory, not a React component.
  const gesture = Gesture.Pan()
    .enabled(enabled)
    .minDistance(0)
    .shouldCancelWhenOutside(false)
    .onStart((event) => {
      // One drag at a time: a second finger on another grip does nothing.
      if (drag.owner.get() >= 0) return;
      drag.owner.set(event.handlerTag);
      drag.y.set(0);
      drag.translation.set(0);
      drag.scrollAtLift.set(drag.scroll.get());
      drag.to.set(index);
      drag.from.set(index);
      scheduleOnRN(hapticTick);
      scheduleOnRN(onAutoScroll, true);
    })
    .onUpdate((event) => {
      if (drag.owner.get() !== event.handlerTag || drag.from.get() !== index) return;
      drag.translation.set(event.translationY);
      followFinger(drag);
    })
    .onFinalize((event, success) => {
      if (drag.owner.get() !== event.handlerTag) return;
      drag.owner.set(-1);
      scheduleOnRN(onAutoScroll, false);
      // A queue change mid-drag already dropped the lift.
      if (drag.from.get() !== index) return;
      const to = success ? drag.to.get() : index;
      drag.to.set(to);
      drag.y.set(
        // A queue change or another drag cuts the settle short; that drop is stale.
        withTiming((to - index) * drag.rowHeight.get(), SETTLE_TIMING, (finished) => {
          if (finished) scheduleOnRN(onDrop, index, to);
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

function RowButton(props: {
  readonly palette: FlatGlassPalette;
  readonly icon: HugeIconData;
  readonly label: string;
  readonly disabled: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ disabled: props.disabled }}
      disabled={props.disabled}
      hitSlop={4}
      onPress={props.onPress}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        alignItems: "center",
        justifyContent: "center",
        opacity: props.disabled ? 0.35 : pressed ? 0.6 : 1,
      })}
    >
      <HugeIcon icon={props.icon} size={16} color={props.palette.foreground} />
    </Pressable>
  );
}
