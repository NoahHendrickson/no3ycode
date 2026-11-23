/**
 * The no3y pills above the composer (`.fork/customizations.yaml#no3y-mobile-redesign`): a row of
 * small glass pills, one per thing going on (status, the thread's pull request, background work,
 * Pi status, previews). Two or more kinds of background work share one pill. The status and
 * background pills open the half-height No3yStatusSheet.tsx with every item and its actions.
 */
import Alert02Icon from "@hugeicons/core-free-icons/Alert02Icon";
import AlertCircleIcon from "@hugeicons/core-free-icons/AlertCircleIcon";
import ArrowDown01Icon from "@hugeicons/core-free-icons/ArrowDown01Icon";
import ArrowShrink02Icon from "@hugeicons/core-free-icons/ArrowShrink02Icon";
import CheckmarkCircle02Icon from "@hugeicons/core-free-icons/CheckmarkCircle02Icon";
import BotMessageSquareIcon from "@hugeicons/core-free-icons/BotMessageSquareIcon";
import Clock01Icon from "@hugeicons/core-free-icons/Clock01Icon";
import ComputerActivityIcon from "@hugeicons/core-free-icons/ComputerActivityIcon";
import ComputerTerminal01Icon from "@hugeicons/core-free-icons/ComputerTerminal01Icon";
import GitPullRequestIcon from "@hugeicons/core-free-icons/GitPullRequestIcon";
import Globe02Icon from "@hugeicons/core-free-icons/Globe02Icon";
import Layers01Icon from "@hugeicons/core-free-icons/Layers01Icon";
import LeftToRightListNumberIcon from "@hugeicons/core-free-icons/LeftToRightListNumberIcon";
import PuzzleIcon from "@hugeicons/core-free-icons/PuzzleIcon";
import Robot01Icon from "@hugeicons/core-free-icons/Robot01Icon";
import SmartPhone01Icon from "@hugeicons/core-free-icons/SmartPhone01Icon";
import SquareStackIcon from "@hugeicons/core-free-icons/SquareStackIcon";
import Target02Icon from "@hugeicons/core-free-icons/Target02Icon";
import WifiDisconnected02Icon from "@hugeicons/core-free-icons/WifiDisconnected02Icon";
import { useAtomValue } from "@effect/atom-react";
import { StackActions, useNavigation } from "@react-navigation/native";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import type { PendingBackgroundWorkPresentation } from "@t3tools/client-runtime/state/thread-execution";
import {
  resolveThreadCurrentPullRequestLink,
  visibleThreadPullRequests,
} from "@t3tools/client-runtime/thread-pull-requests";
import type {
  EnvironmentId,
  PullRequestChecksState,
  ScopedThreadRef,
  ThreadId,
} from "@t3tools/contracts";
import { useEffect, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { Keyboard, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";

import { AppActivityIndicator } from "../src/components/ui/AppActivityIndicator";
import { AppText as Text } from "../src/components/ui/AppText";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import type { FloatingWorkingControl } from "../src/features/threads/floating-working-control";
import { useThreadTurnSubagents } from "../src/features/threads/ThreadAgentsSheet";
import { resolveSubagentRowPresentation } from "../src/features/threads/threadAgentsPresentation";
import { useOpenThreadPullRequests } from "../src/features/threads/use-open-thread-pull-requests";
import { useOpenLinkedThread } from "../src/features/threads/useOpenLinkedThread";
import { scopedThreadKey } from "../src/lib/scopedEntities";
import { useChildThreadInputs } from "../src/state/entities";
import { environmentThreadShells } from "../src/state/threads";
import { useThreadPr, type ThreadPrPresentation } from "../src/state/use-thread-pr";
import { flatGlassPalette, NO3Y_FONT, type FlatGlassPalette } from "./flatGlassTheme";
import { HugeIcon, type HugeIconData } from "./HugeIcon";
import { No3yBeadRing } from "./No3yBeadRing";
import { No3yGlassLayer } from "./No3yGlass";
import type { No3yPillStatus } from "./no3yPillStatus";
import { no3yPullRequestTone, type No3yPullRequestTone } from "./no3yPullRequestTone";
import {
  no3yGroupBackground,
  no3yStatusSegments,
  no3ySubagentMarkKind,
  type No3yStatusSegment,
} from "./no3yStatusSegments";
import { publishNo3yStatusSheet, type No3yStatusSheetModel } from "./no3yStatusSheetStore";
import { NO3Y_GLASS_IN, NO3Y_LAYOUT } from "./no3yMotion";

const PILL_HEIGHT = 32;
const PILL_RADIUS = 14;
/** Between the pills and the composer card below them. */
const ROW_GAP = 12;
// The composer card starts this far below the overlay's anchor (upstream's COMPOSER_CAPSULE_INSET).
const COMPOSER_CAPSULE_INSET = 6;
// The no3y composer card's side inset (ThreadComposer's no3y padding).
const CARD_SIDE_INSET = 16;
/** The pills start this far in from the card's left edge. */
const ROW_INSET = 24;
/** Room above and below the pills inside the scrolling row, so their shadow is not clipped. */
const SHADOW_ROOM = 4;
const ICON_SIZE = 16;

type UpstreamProps = ComponentProps<typeof FloatingWorkingControl>;

interface No3yPillExtras {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly backgroundWork: PendingBackgroundWorkPresentation | null;
  /** The loaded thread detail the upstream agents segment reads, or null before it loads. */
  readonly detailRef: ScopedThreadRef | null;
  /** The pill's own status: upstream's, plus the states upstream moved into the feed. */
  readonly no3yStatus: No3yPillStatus | null;
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
      no3yStatus={props.no3yStatus}
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
  const status = props.no3yStatus;
  const extension =
    status?.kind === "extension"
      ? { label: status.label, onPress: status.onPress }
      : (props.extensionStatus ?? null);
  const backgroundItems = props.backgroundWork?.items ?? [];
  const turnSubagents = props.agents !== null ? (turn?.subagents ?? []) : [];
  const thread = useAtomValue(
    environmentThreadShells.threadShellAtom(scopeThreadRef(props.environmentId, props.threadId)),
  );
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
  const pills = no3yGroupBackground(segments);

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

  const hasPullRequest = thread !== null && no3yThreadHasPullRequest(thread);
  if (pills.length === 0 && !hasPullRequest && !props.showScrollToEnd) return null;

  const openSheet = () => {
    Keyboard.dismiss();
    navigation.dispatch(StackActions.push("No3yThreadStatus", { threadKey }));
  };
  const onPress = (segment: No3yStatusSegment): (() => void) => {
    switch (segment.kind) {
      case "subagents":
        return props.agents !== null
          ? () => {
              Keyboard.dismiss();
              props.onOpenAgents();
            }
          : openSheet;
      case "extension":
        return extension?.onPress ?? openSheet;
      case "devices":
        return props.devicePreview?.onPress ?? openSheet;
      case "browser":
        return props.browserPreview?.onPress ?? openSheet;
      default:
        return openSheet;
    }
  };

  const renderSegment = (segment: No3yStatusSegment) => (
    <SegmentPill
      key={segment.kind}
      segment={segment}
      status={status}
      extensionLabel={extension?.label ?? null}
      agentsLabel={props.agents?.accessibilityLabel}
      palette={palette}
      onPress={onPress(segment)}
    />
  );

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        {
          position: "absolute",
          left: 0,
          right: 0,
          top: -(PILL_HEIGHT + ROW_GAP - COMPOSER_CAPSULE_INSET) - SHADOW_ROOM,
          zIndex: 20,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        },
        liftStyle,
      ]}
    >
      {/* Only as wide as its pills, so the transcript beside them still takes touches. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={{ flexGrow: 0, flexShrink: 1 }}
        contentContainerStyle={{
          alignItems: "center",
          gap: 8,
          paddingLeft: CARD_SIDE_INSET + ROW_INSET,
          paddingRight: 8,
          paddingVertical: SHADOW_ROOM,
        }}
      >
        {pills.filter((segment) => segment.kind === "status").map(renderSegment)}
        {thread ? (
          <PullRequestPill thread={thread} palette={palette} dark={themeAppearance === "dark"} />
        ) : null}
        {pills.filter((segment) => segment.kind !== "status").map(renderSegment)}
      </ScrollView>
      {props.showScrollToEnd ? (
        <Animated.View
          entering={NO3Y_GLASS_IN}
          layout={NO3Y_LAYOUT}
          style={{
            width: PILL_HEIGHT,
            height: PILL_HEIGHT,
            marginRight: CARD_SIDE_INSET,
            boxShadow: palette.pillShadow,
            borderRadius: PILL_HEIGHT / 2,
          }}
        >
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
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/**
 * Whether the row draws a pull request pill, so the feed keeps clear of the row for it alone: a
 * linked pull request not dismissed from its stack, else a branch one (useThreadPr's sources).
 */
export function no3yThreadHasPullRequest(
  thread: Pick<EnvironmentThreadShell, "pullRequests" | "linkedPullRequest" | "branchPullRequest">,
): boolean {
  return (
    visibleThreadPullRequests(thread.pullRequests ?? []).length > 0 ||
    (thread.linkedPullRequest ?? thread.branchPullRequest ?? null) !== null
  );
}

/** One pill: glass (tinted for a pull request), a 16pt icon, 12pt text. */
function Pill(props: {
  readonly accessibilityLabel: string;
  readonly accessibilityHint?: string;
  readonly onPress: () => void;
  readonly palette: FlatGlassPalette;
  readonly tint?: string;
  /** An inner glow, as a box shadow: the stacked pull request's purple-to-green. */
  readonly glow?: string;
  readonly children: ReactNode;
}) {
  return (
    <Animated.View
      entering={NO3Y_GLASS_IN}
      layout={NO3Y_LAYOUT}
      style={{
        height: PILL_HEIGHT,
        borderRadius: PILL_RADIUS,
        boxShadow: props.palette.pillShadow,
      }}
    >
      <No3yGlassLayer
        radius={PILL_RADIUS}
        {...(props.tint === undefined ? {} : { tint: props.tint })}
      />
      {props.glow === undefined ? null : (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius: PILL_RADIUS, boxShadow: props.glow }]}
        />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.accessibilityLabel}
        {...(props.accessibilityHint === undefined
          ? {}
          : { accessibilityHint: props.accessibilityHint })}
        hitSlop={6}
        onPress={props.onPress}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingHorizontal: 8,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        {props.children}
      </Pressable>
    </Animated.View>
  );
}

const STACK_GLOW_DARK =
  "inset -1px -1px 2px 0px rgba(18, 199, 69, 0.2), inset 1px 1px 2px 0px rgba(119, 56, 236, 0.7), inset -1px -1px 12px 0px rgba(9, 183, 61, 0.6), inset 1px 1px 12px 1px rgba(87, 35, 185, 0.8)";
const STACK_GLOW_LIGHT =
  "inset -1px -1px 2px 0px rgba(18, 199, 69, 0.2), inset 1px 1px 2px 0px rgba(119, 56, 236, 0.45), inset -1px -1px 10px 0px rgba(9, 183, 61, 0.25), inset 1px 1px 10px 0px rgba(87, 35, 185, 0.3)";

function PillText(props: { readonly color: string; readonly children: ReactNode }) {
  return (
    <Text
      numberOfLines={1}
      style={{
        ...NO3Y_FONT.regular,
        fontSize: 12,
        fontVariant: ["tabular-nums"],
        color: props.color,
      }}
    >
      {props.children}
    </Text>
  );
}

function NeedsYouDot(props: { readonly palette: FlatGlassPalette }) {
  return (
    <View
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        marginLeft: 2,
        backgroundColor: props.palette.statusAttention,
      }}
    />
  );
}

const SEGMENT_ICONS: Readonly<
  Record<Exclude<No3yStatusSegment["kind"], "status">, { icon: HugeIconData; filled: boolean }>
> = {
  processes: { icon: ComputerTerminal01Icon, filled: false },
  monitors: { icon: ComputerActivityIcon, filled: false },
  subagents: { icon: BotMessageSquareIcon, filled: false },
  background: { icon: SquareStackIcon, filled: true },
  extension: { icon: PuzzleIcon, filled: false },
  queue: { icon: LeftToRightListNumberIcon, filled: false },
  devices: { icon: SmartPhone01Icon, filled: false },
  browser: { icon: Globe02Icon, filled: false },
};

function SegmentPill(props: {
  readonly segment: No3yStatusSegment;
  readonly status: No3yPillStatus | null;
  readonly extensionLabel: string | null;
  readonly agentsLabel: string | undefined;
  readonly palette: FlatGlassPalette;
  readonly onPress: () => void;
}) {
  const { segment, palette, status } = props;
  if (segment.kind === "status" && status === null) return null;
  const ink = segment.quiet ? palette.quietInk : palette.foreground;
  const text = segmentText(segment, status, props.extensionLabel);
  const label =
    segment.kind === "subagents" && props.agentsLabel !== undefined ? props.agentsLabel : text;
  return (
    <Pill
      accessibilityLabel={`${label}${segment.needsYou ? ", needs you" : ""}`}
      {...(segment.kind === "status" || segment.kind === "background"
        ? { accessibilityHint: "Opens the thread's activity" }
        : {})}
      onPress={props.onPress}
      palette={palette}
    >
      {segment.kind === "status" ? (
        status === null ? null : (
          <No3yStatusGlyph status={status} palette={palette} />
        )
      ) : (
        <HugeIcon
          icon={SEGMENT_ICONS[segment.kind].icon}
          filled={SEGMENT_ICONS[segment.kind].filled}
          size={ICON_SIZE}
          color={ink}
        />
      )}
      <PillText color={ink}>{text}</PillText>
      {segment.kind === "background" ? (
        <HugeIcon icon={ArrowDown01Icon} size={ICON_SIZE} color={ink} />
      ) : null}
      {segment.needsYou ? <NeedsYouDot palette={palette} /> : null}
    </Pill>
  );
}

function counted(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function segmentText(
  segment: No3yStatusSegment,
  status: No3yPillStatus | null,
  extensionLabel: string | null,
): string {
  const count = segment.count ?? 0;
  switch (segment.kind) {
    case "status":
      if (status === null) return "";
      if (status.kind === "compacting") return "Compacting";
      if (status.kind === "working") return "Working";
      return status.label;
    case "processes":
      return counted(count, "process", "processes");
    case "monitors":
      return count === 1 ? "Monitoring" : `${count} monitors`;
    case "subagents":
      return counted(count, "subagent", "subagents");
    case "background":
      return counted(count, "background task", "background tasks");
    case "extension":
      return extensionLabel ?? "Pi";
    case "queue":
      return `${count} queued`;
    case "devices":
      return count === 1 ? "Device" : `${count} devices`;
    case "browser":
      return count === 1 ? "Browser" : `${count} tabs`;
  }
}

/** Figma's pull request pill fills (dark) and the Mac's state inks; draft stays plain glass. */
const PR_PILL_DARK: Record<Exclude<No3yPullRequestTone, "draft">, { tint: string; ink: string }> = {
  open: { tint: "rgba(14, 127, 82, 0.6)", ink: "#75F1A1" },
  merged: { tint: "rgba(51, 38, 116, 0.6)", ink: "#A38FFA" },
  closed: { tint: "rgba(127, 29, 29, 0.6)", ink: "#FFA2A2" },
};
const PR_PILL_LIGHT_TINT: Record<Exclude<No3yPullRequestTone, "draft">, string> = {
  open: "rgba(5, 150, 105, 0.16)",
  merged: "rgba(127, 34, 254, 0.12)",
  closed: "rgba(231, 0, 11, 0.10)",
};

function pullRequestPillColors(
  tone: No3yPullRequestTone,
  palette: FlatGlassPalette,
  dark: boolean,
): { readonly tint: string | undefined; readonly ink: string } {
  if (tone === "draft") return { tint: undefined, ink: palette.prDraft };
  if (dark) return PR_PILL_DARK[tone];
  const ink =
    tone === "open" ? palette.prOpen : tone === "merged" ? palette.prMerged : palette.prClosed;
  return { tint: PR_PILL_LIGHT_TINT[tone], ink };
}

/**
 * The thread's pull request: its number on its state's colour, a stack or several as a layers
 * glyph with how many more, and a running or failing checks mark on an open one.
 */
function PullRequestPill(props: {
  readonly thread: EnvironmentThreadShell;
  readonly palette: FlatGlassPalette;
  readonly dark: boolean;
}) {
  const { thread } = props;
  const pr = useThreadPr(thread);
  const openPullRequests = useOpenThreadPullRequests();
  if (pr === null) return null;
  const checks =
    pr.kind === "pull-request" && pr.others === 0 && pr.state === "open"
      ? (resolveThreadCurrentPullRequestLink(thread.pullRequests ?? [])?.snapshot?.checksState ??
        null)
      : null;
  return (
    <PullRequestPillView
      pr={pr}
      checks={checks}
      palette={props.palette}
      dark={props.dark}
      onPress={() => openPullRequests(thread, pr)}
    />
  );
}

function PullRequestPillView(props: {
  readonly pr: ThreadPrPresentation;
  readonly checks: PullRequestChecksState | null;
  readonly palette: FlatGlassPalette;
  readonly dark: boolean;
  readonly onPress: () => void;
}) {
  const { pr, checks, palette } = props;
  const several = pr.kind === "stack" || pr.others > 0;
  const more = pr.kind === "stack" ? Number(pr.label) - 1 : pr.others;
  const tone = no3yPullRequestTone({ state: pr.state, isDraft: pr.isDraft });
  const colors = several
    ? { tint: undefined, ink: palette.foreground }
    : pullRequestPillColors(tone, palette, props.dark);
  return (
    <Pill
      accessibilityLabel={`${pr.accessibilityLabel}${checks === "pending" ? ", checks running" : checks === "failing" ? ", checks failing" : ""}`}
      onPress={props.onPress}
      palette={palette}
      {...(colors.tint === undefined ? {} : { tint: colors.tint })}
      {...(several ? { glow: props.dark ? STACK_GLOW_DARK : STACK_GLOW_LIGHT } : {})}
    >
      <HugeIcon
        icon={several ? Layers01Icon : GitPullRequestIcon}
        filled={several}
        size={ICON_SIZE}
        color={colors.ink}
      />
      <PillText color={colors.ink}>{pr.number}</PillText>
      {several && more > 0 ? <PillText color={colors.ink}>{`${more}+`}</PillText> : null}
      {checks === "pending" ? <ChecksRunningMark color={palette.statusAttention} /> : null}
      {checks === "failing" ? (
        <HugeIcon icon={AlertCircleIcon} size={ICON_SIZE} color={palette.prClosed} />
      ) : null}
    </Pill>
  );
}

/** Figma's checks-running mark: a ring with a three-quarter pie. */
function ChecksRunningMark(props: { readonly color: string }) {
  return (
    <View
      style={{
        width: ICON_SIZE,
        height: ICON_SIZE,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
        <Path
          d="M11 7C11 7.79113 10.7654 8.56448 10.3259 9.22228C9.88635 9.88008 9.26164 10.3928 8.53073 10.6955C7.79983 10.9983 6.99556 11.0775 6.21964 10.9231C5.44371 10.7688 4.73098 10.3878 4.17157 9.82843C3.61216 9.26902 3.2312 8.55629 3.07686 7.78036C2.92252 7.00444 3.00173 6.20017 3.30448 5.46927C3.60723 4.73836 4.11992 4.11365 4.77772 3.67412C5.43552 3.2346 6.20887 3 7 3V7H11Z"
          fill={props.color}
        />
        <Circle cx={7} cy={7} r={6.5} stroke={props.color} />
      </Svg>
    </View>
  );
}

function StatusIcon(props: { readonly icon: HugeIconData; readonly color: string }) {
  return <HugeIcon icon={props.icon} size={ICON_SIZE} color={props.color} />;
}

/** The mark for a transient status: the bead ring while working, a spinner while waiting on it. */
export function No3yStatusGlyph(props: {
  readonly status: No3yPillStatus;
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
