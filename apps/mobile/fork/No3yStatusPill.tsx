/**
 * The no3y thread status pill (`.fork/customizations.yaml#no3y-mobile-redesign`): one small glass
 * pill right-aligned above the composer card, a segment per active kind. A tap opens the
 * half-height No3yStatusSheet.tsx with every item and the actions the upstream control offered.
 */
import Alert02Icon from "@hugeicons/core-free-icons/Alert02Icon";
import ArrowDown01Icon from "@hugeicons/core-free-icons/ArrowDown01Icon";
import ArrowShrink02Icon from "@hugeicons/core-free-icons/ArrowShrink02Icon";
import CheckmarkCircle02Icon from "@hugeicons/core-free-icons/CheckmarkCircle02Icon";
import Clock01Icon from "@hugeicons/core-free-icons/Clock01Icon";
import ComputerTerminal01Icon from "@hugeicons/core-free-icons/ComputerTerminal01Icon";
import Globe02Icon from "@hugeicons/core-free-icons/Globe02Icon";
import LeftToRightListNumberIcon from "@hugeicons/core-free-icons/LeftToRightListNumberIcon";
import PuzzleIcon from "@hugeicons/core-free-icons/PuzzleIcon";
import Radar01Icon from "@hugeicons/core-free-icons/Radar01Icon";
import Robot01Icon from "@hugeicons/core-free-icons/Robot01Icon";
import SmartPhone01Icon from "@hugeicons/core-free-icons/SmartPhone01Icon";
import Target02Icon from "@hugeicons/core-free-icons/Target02Icon";
import WifiDisconnected02Icon from "@hugeicons/core-free-icons/WifiDisconnected02Icon";
import { StackActions, useNavigation } from "@react-navigation/native";
import type { PendingBackgroundWorkPresentation } from "@t3tools/client-runtime/state/thread-execution";
import type { EnvironmentId, ScopedThreadRef, ThreadId } from "@t3tools/contracts";
import { Fragment, useEffect, type ComponentProps, type ReactElement } from "react";
import { Keyboard, Pressable, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { AppActivityIndicator } from "../src/components/ui/AppActivityIndicator";
import { AppText as Text } from "../src/components/ui/AppText";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import type { FloatingWorkingControl } from "../src/features/threads/floating-working-control";
import type { FloatingWorkingStatus } from "../src/features/threads/floating-working-status";
import { useThreadTurnSubagents } from "../src/features/threads/ThreadAgentsSheet";
import { resolveSubagentRowPresentation } from "../src/features/threads/threadAgentsPresentation";
import { useOpenLinkedThread } from "../src/features/threads/useOpenLinkedThread";
import { useVisibleSecondClock } from "../src/features/threads/use-visible-second-clock";
import { scopedThreadKey } from "../src/lib/scopedEntities";
import { useChildThreadInputs } from "../src/state/entities";
import { flatGlassPalette, NO3Y_FONT, type FlatGlassPalette } from "./flatGlassTheme";
import { HugeIcon, type HugeIconData } from "./HugeIcon";
import { No3yBeadRing } from "./No3yBeadRing";
import { No3yGlassLayer } from "./No3yGlass";
import {
  no3yElapsedLabel,
  no3yStatusSegments,
  no3ySubagentMarkKind,
  type No3yStatusSegment,
} from "./no3yStatusSegments";
import { publishNo3yStatusSheet, type No3yStatusSheetModel } from "./no3yStatusSheetStore";

const PILL_HEIGHT = 30;
const PILL_GAP = 8;
// The composer card starts this far below the overlay's anchor (upstream's COMPOSER_CAPSULE_INSET).
const COMPOSER_CAPSULE_INSET = 6;
// The no3y composer card's side inset (ThreadComposer's no3y padding), so the pill ends at its edge.
const CARD_SIDE_INSET = 16;
const ICON_SIZE = 15;

type UpstreamProps = ComponentProps<typeof FloatingWorkingControl>;

interface No3yPillExtras {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly backgroundWork: PendingBackgroundWorkPresentation | null;
  /** The loaded thread detail the upstream agents segment reads, or null before it loads. */
  readonly detailRef: ScopedThreadRef | null;
}

/**
 * Draws the no3y pill in place of the upstream control it wraps while the redesign is on, from
 * the same props, so the upstream call site stays as it is.
 */
export function No3yStatusPillSwap(
  props: No3yPillExtras & {
    readonly enabled: boolean;
    readonly children: ReactElement<UpstreamProps>;
  },
) {
  if (!props.enabled) return props.children;
  return (
    <No3yStatusPill
      {...props.children.props}
      environmentId={props.environmentId}
      threadId={props.threadId}
      backgroundWork={props.backgroundWork}
      detailRef={props.detailRef}
    />
  );
}

function No3yStatusPill(props: UpstreamProps & No3yPillExtras) {
  const navigation = useNavigation();
  const openLinkedThread = useOpenLinkedThread();
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const threadRef = { environmentId: props.environmentId, threadId: props.threadId };
  const threadKey = scopedThreadKey(props.environmentId, props.threadId);
  const turn = useThreadTurnSubagents(props.detailRef);
  const childInputs = useChildThreadInputs(threadRef);
  const status = props.status;
  const extension =
    status?.kind === "extension"
      ? { label: status.label, onPress: status.onPress }
      : (props.extensionStatus ?? null);
  const backgroundItems = props.backgroundWork?.items ?? [];
  const turnSubagents = props.agents !== null ? (turn?.subagents ?? []) : [];
  const segments = no3yStatusSegments({
    status,
    backgroundKinds: backgroundItems.map((item) => item.kind),
    subagents:
      props.agents !== null && turn !== null
        ? { live: turn.liveCount, total: turn.subagents.length }
        : null,
    childInputCount: childInputs.length,
    extension: extension !== null,
    // Queued messages live in the banner above the composer (No3yQueuedRunsBanner.tsx).
    queuedCount: 0,
    deviceCount: props.devicePreview?.count ?? 0,
    browserCount: props.browserPreview?.count ?? 0,
  });

  const model: No3yStatusSheetModel = {
    status,
    extension,
    background:
      backgroundItems.length === 0
        ? null
        : {
            items: backgroundItems,
            // The upstream Stop interrupts the turn, so it is only offered while no turn runs.
            stop: status?.kind === "background" ? status.action : null,
            onOpenDetails: () =>
              navigation.navigate("ThreadBackgroundWork", {
                environmentId: props.environmentId,
                threadId: props.threadId,
              }),
          },
    subagents: turnSubagents.map((subagent) => {
      const child = childInputs.find((input) => input.id === subagent.childThreadId);
      return {
        id: subagent.id,
        title: resolveSubagentRowPresentation(subagent).title,
        mark: no3ySubagentMarkKind(
          subagent.status,
          child === undefined ? null : child.hasPendingApprovals ? "approval" : "input",
        ),
      };
    }),
    onOpenAgents: props.agents !== null ? props.onOpenAgents : null,
    childInputs: childInputs.map((child) => ({
      id: child.id,
      title: child.title,
      needs: child.hasPendingApprovals ? "approval" : "input",
      onOpen: () => openLinkedThread({ environmentId: child.environmentId, threadId: child.id }),
    })),
    queue: null,
    devicePreview: props.devicePreview,
    browserPreview: props.browserPreview,
  };
  // Hands the status sheet route this render's status and fresh action closures.
  useEffect(() => {
    publishNo3yStatusSheet(threadKey, model);
  });
  useEffect(() => () => publishNo3yStatusSheet(threadKey, null), [threadKey]);

  const lift = props.lift;
  const liftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -(lift?.value ?? 0) }],
  }));

  if (segments.length === 0 && !props.showScrollToEnd) return null;

  const openSheet = () => {
    Keyboard.dismiss();
    navigation.dispatch(StackActions.push("No3yThreadStatus", { threadKey }));
  };
  const accessibilityLabel = segments
    .map((segment) => segmentAccessibilityLabel(segment, status, props.agents?.accessibilityLabel))
    .join(", ");

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        {
          position: "absolute",
          left: 0,
          right: 0,
          top: -(PILL_HEIGHT + PILL_GAP - COMPOSER_CAPSULE_INSET),
          zIndex: 20,
          flexDirection: "row",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: PILL_GAP,
          paddingHorizontal: CARD_SIDE_INSET,
        },
        liftStyle,
      ]}
    >
      {props.showScrollToEnd ? (
        <View style={{ width: PILL_HEIGHT, height: PILL_HEIGHT }}>
          <No3yGlassLayer radius={PILL_HEIGHT / 2} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scroll to end"
            hitSlop={7}
            onPressIn={props.onScrollToEnd}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <HugeIcon icon={ArrowDown01Icon} size={ICON_SIZE} color={palette.foreground} />
          </Pressable>
        </View>
      ) : null}
      {segments.length > 0 ? (
        <View style={{ height: PILL_HEIGHT }}>
          <No3yGlassLayer radius={PILL_HEIGHT / 2} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityHint="Opens the thread's activity"
            hitSlop={7}
            onPress={openSheet}
            style={({ pressed }) => ({
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 10,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            {segments.map((segment, index) => (
              <Fragment key={segment.kind}>
                {index > 0 ? (
                  <View style={{ width: 1, height: 14, backgroundColor: palette.hairline }} />
                ) : null}
                <PillSegment segment={segment} status={status} palette={palette} />
              </Fragment>
            ))}
          </Pressable>
        </View>
      ) : null}
    </Animated.View>
  );
}

const SEGMENT_ICONS: Readonly<Record<Exclude<No3yStatusSegment["kind"], "status">, HugeIconData>> =
  {
    processes: ComputerTerminal01Icon,
    monitors: Radar01Icon,
    subagents: Robot01Icon,
    extension: PuzzleIcon,
    queue: LeftToRightListNumberIcon,
    devices: SmartPhone01Icon,
    browser: Globe02Icon,
  };

function PillSegment(props: {
  readonly segment: No3yStatusSegment;
  readonly status: FloatingWorkingStatus | null;
  readonly palette: FlatGlassPalette;
}) {
  const { segment, palette, status } = props;
  const ink = segment.quiet ? palette.quietInk : palette.foreground;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      {segment.kind === "status" ? (
        status === null ? null : (
          <No3yStatusGlyph status={status} palette={palette} />
        )
      ) : (
        <HugeIcon icon={SEGMENT_ICONS[segment.kind]} size={ICON_SIZE} color={ink} />
      )}
      {segment.kind === "status" && status?.kind === "working" ? (
        <WorkingElapsed startedAt={status.startedAt} palette={palette} />
      ) : segment.count !== null ? (
        <Text
          style={{
            ...NO3Y_FONT.medium,
            fontSize: 13,
            fontVariant: ["tabular-nums"],
            color: ink,
          }}
        >
          {segment.count}
        </Text>
      ) : null}
      {segment.needsYou ? (
        <View
          style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.statusAttention }}
        />
      ) : null}
    </View>
  );
}

function WorkingElapsed(props: { readonly startedAt: string; readonly palette: FlatGlassPalette }) {
  const nowMs = useVisibleSecondClock(true);
  return (
    <Text
      style={{
        ...NO3Y_FONT.medium,
        fontSize: 13,
        fontVariant: ["tabular-nums"],
        color: props.palette.foreground,
      }}
    >
      {no3yElapsedLabel(props.startedAt, nowMs)}
    </Text>
  );
}

function StatusIcon(props: { readonly icon: HugeIconData; readonly color: string }) {
  return <HugeIcon icon={props.icon} size={ICON_SIZE} color={props.color} />;
}

/** The mark for a transient status: the bead ring while working, a spinner while waiting on it. */
export function No3yStatusGlyph(props: {
  readonly status: FloatingWorkingStatus;
  readonly palette: FlatGlassPalette;
}) {
  const { status, palette } = props;
  const ink = palette.foreground;
  switch (status.kind) {
    case "working":
      return <No3yBeadRing color={palette.statusWorking} size={16} />;
    case "compacting":
      return <StatusIcon icon={ArrowShrink02Icon} color={ink} />;
    case "connection":
      return status.tone === "reconnecting" ? (
        <Spinner />
      ) : (
        <StatusIcon icon={WifiDisconnected02Icon} color={ink} />
      );
    case "stop":
      return status.unresponsive ? (
        <StatusIcon icon={Alert02Icon} color={palette.statusAttention} />
      ) : (
        <Spinner />
      );
    case "lifecycle":
      return (
        <StatusIcon
          icon={status.state === "settled" ? CheckmarkCircle02Icon : Clock01Icon}
          color={ink}
        />
      );
    case "goal":
      return <StatusIcon icon={Target02Icon} color={ink} />;
    case "extension":
      return <StatusIcon icon={PuzzleIcon} color={ink} />;
    case "background":
      return <StatusIcon icon={ComputerTerminal01Icon} color={ink} />;
    case "child-input":
      return <StatusIcon icon={Robot01Icon} color={ink} />;
    case "syncing":
    case "preparing":
      return <Spinner />;
  }
}

function Spinner() {
  return (
    <View style={{ width: 16, height: 16, alignItems: "center", justifyContent: "center" }}>
      <AppActivityIndicator
        size="small"
        colorClassName="accent-icon-muted"
        style={{ transform: [{ scale: 0.7 }] }}
      />
    </View>
  );
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function segmentAccessibilityLabel(
  segment: No3yStatusSegment,
  status: FloatingWorkingStatus | null,
  agentsLabel: string | undefined,
): string {
  const needs = segment.needsYou ? ", needs you" : "";
  const count = segment.count ?? 0;
  switch (segment.kind) {
    case "status":
      if (status === null) return "";
      if (status.kind === "working") return "Working";
      if (status.kind === "compacting") return "Compacting";
      return `${"label" in status ? status.label : ""}${needs}`;
    case "processes":
      return `${count} background ${count === 1 ? "process" : "processes"}`;
    case "monitors":
      return plural(count, "monitor");
    case "subagents":
      return `${agentsLabel ?? plural(count, "subagent")}${needs}`;
    case "extension":
      return "Pi status";
    case "queue":
      return `${count} queued`;
    case "devices":
      return plural(count, "device preview");
    case "browser":
      return plural(count, "browser tab");
  }
}
