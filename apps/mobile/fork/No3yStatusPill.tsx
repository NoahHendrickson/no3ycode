/**
 * The no3y pills above the composer (`.fork/customizations.yaml#no3y-mobile-redesign`): a row of
 * small glass pills, one per thing going on (status, the thread's pull request, background work,
 * Pi status, previews). Two or more kinds of background work share one pill. The status and
 * background pills open the half-height No3yStatusSheet.tsx with every item and its actions.
 */
import Alert02Icon from "@hugeicons/core-free-icons/Alert02Icon";
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
import { StackActions, useNavigation } from "@react-navigation/native";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import type { PendingBackgroundWorkPresentation } from "@t3tools/client-runtime/state/thread-execution";
import type { EnvironmentId, ScopedThreadRef, ThreadId } from "@t3tools/contracts";
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
import type { ThreadPrPresentation } from "../src/state/use-thread-pr";
import { flatGlassPalette, NO3Y_FONT, type FlatGlassPalette } from "./flatGlassTheme";
import { HugeIcon, type HugeIconData } from "./HugeIcon";
import { No3yBeadRing } from "./No3yBeadRing";
import { No3yGlassLayer } from "./No3yGlass";
import type { No3yPillStatus } from "./no3yPillStatus";
import { no3yPullRequestPill, type No3yPullRequestPill } from "./no3yPullRequestTone";
import {
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
/** The pills and the scroll button sit this far in from the card's edges, clear of its corners. */
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
  readonly thread: EnvironmentThreadShell;
  /** The thread's pull request as useThreadPr resolves it; the screen keeps the feed clear of it. */
  readonly pullRequest: ThreadPrPresentation | null;
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
      thread={props.thread}
      pullRequest={props.pullRequest}
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
  const openPullRequests = useOpenThreadPullRequests();
  const pills = no3yStatusSegments({
    status,
    pullRequest: props.pullRequest !== null,
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

  if (pills.length === 0 && !props.showScrollToEnd) return null;

  const openSheet = () => {
    Keyboard.dismiss();
    navigation.dispatch(StackActions.push("No3yThreadStatus", { threadKey }));
  };
  const targets: PillTargets = {
    sheet: openSheet,
    agents:
      props.agents !== null
        ? () => {
            Keyboard.dismiss();
            props.onOpenAgents();
          }
        : null,
    agentsLabel: props.agents?.accessibilityLabel,
    extension,
    devices: props.devicePreview?.onPress ?? null,
    browser: props.browserPreview?.onPress ?? null,
  };
  const { pullRequest } = props;
  const renderPill = (segment: No3yStatusSegment) => {
    if (segment.kind === "pullRequest") {
      return pullRequest === null ? null : (
        <PullRequestPill
          key={segment.kind}
          pr={pullRequest}
          look={no3yPullRequestPill(pullRequest, props.thread.pullRequests ?? [])}
          palette={palette}
          onPress={() => openPullRequests(props.thread, pullRequest)}
        />
      );
    }
    const spec = pillSpec(segment, targets);
    const ink = spec.quiet ? palette.quietInk : palette.foreground;
    return (
      <Pill
        key={segment.kind}
        accessibilityLabel={`${spec.accessibilityLabel}${spec.needsYou ? ", needs you" : ""}`}
        accessibilityHint={spec.onPress === openSheet ? "Opens the thread's activity" : undefined}
        onPress={spec.onPress}
        palette={palette}
      >
        {spec.icon === null ? (
          segment.kind === "status" ? (
            <No3yStatusGlyph status={segment.status} palette={palette} />
          ) : null
        ) : (
          <HugeIcon icon={spec.icon} filled={spec.filled} size={ICON_SIZE} color={ink} />
        )}
        <PillText color={ink}>{spec.text}</PillText>
        {spec.chevron ? <HugeIcon icon={ArrowDown01Icon} size={ICON_SIZE} color={ink} /> : null}
        {spec.needsYou ? <NeedsYouDot palette={palette} /> : null}
      </Pill>
    );
  };

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
          alignItems: "center",
        },
        liftStyle,
      ]}
    >
      {/* Only as wide as its pills, and only there with pills, so the transcript takes touches. */}
      {pills.length > 0 ? (
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
          {pills.map(renderPill)}
        </ScrollView>
      ) : null}
      {props.showScrollToEnd ? (
        <Animated.View
          entering={NO3Y_GLASS_IN}
          layout={NO3Y_LAYOUT}
          style={{
            width: PILL_HEIGHT,
            height: PILL_HEIGHT,
            marginLeft: "auto",
            marginRight: CARD_SIDE_INSET + ROW_INSET,
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
 * The thread ThreadDetailScreen resolves its pull request from (useThreadPr) for the pills: the
 * thread itself on the no3y layout, and elsewhere the thread without pull request references, so
 * the upstream layouts start no pull request read of their own.
 */
export function no3yPullRequestThread(
  thread: EnvironmentThreadShell,
  enabled: boolean,
): EnvironmentThreadShell {
  if (enabled) return thread;
  const { linkedPullRequest: _linked, branchPullRequest: _branch, ...rest } = thread;
  return { ...rest, pullRequests: NO_PULL_REQUESTS };
}

const NO_PULL_REQUESTS: EnvironmentThreadShell["pullRequests"] = [];

/** One pill: glass (tinted for a pull request), a 16pt icon, 12pt text. */
function Pill(props: {
  readonly accessibilityLabel: string;
  readonly accessibilityHint?: string | undefined;
  readonly onPress: () => void;
  readonly palette: FlatGlassPalette;
  readonly tint?: string | undefined;
  /** An inner glow, as a box shadow: the stacked pull request's purple-to-green. */
  readonly glow?: string | undefined;
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
      <No3yGlassLayer radius={PILL_RADIUS} tint={props.tint} />
      {props.glow === undefined ? null : (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius: PILL_RADIUS, boxShadow: props.glow }]}
        />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.accessibilityLabel}
        accessibilityHint={props.accessibilityHint}
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

/** Where the pills go when tapped, from the upstream control's props. */
interface PillTargets {
  /** The thread's activity sheet (No3yStatusSheet.tsx). */
  readonly sheet: () => void;
  readonly agents: (() => void) | null;
  readonly agentsLabel: string | undefined;
  readonly extension: { readonly label: string; readonly onPress: () => void } | null;
  readonly devices: (() => void) | null;
  readonly browser: (() => void) | null;
}

interface PillSpec {
  /** Null for the status pill, which draws its status glyph. */
  readonly icon: HugeIconData | null;
  readonly filled: boolean;
  readonly text: string;
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
  /** The background group's chevron: it opens into the activity sheet. */
  readonly chevron: boolean;
  readonly needsYou: boolean;
  readonly quiet: boolean;
}

function counted(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/** Every pill but the pull request's: its icon, words and target, decided once per kind. */
function pillSpec(
  segment: Exclude<No3yStatusSegment, { readonly kind: "pullRequest" }>,
  targets: PillTargets,
): PillSpec {
  const spec = (
    icon: HugeIconData | null,
    text: string,
    onPress: () => void,
    extra: Partial<Pick<PillSpec, "filled" | "chevron" | "accessibilityLabel">> = {},
  ): PillSpec => ({
    icon,
    text,
    onPress,
    accessibilityLabel: extra.accessibilityLabel ?? text,
    filled: extra.filled ?? false,
    chevron: extra.chevron ?? false,
    needsYou: segment.kind === "extension" ? false : segment.needsYou,
    quiet: segment.kind === "extension" || segment.kind === "status" ? false : segment.quiet,
  });
  switch (segment.kind) {
    case "status": {
      const { status } = segment;
      const text =
        status.kind === "compacting"
          ? "Compacting"
          : status.kind === "working"
            ? "Working"
            : status.label;
      return spec(null, text, targets.sheet);
    }
    case "extension":
      return spec(
        PuzzleIcon,
        targets.extension?.label ?? "Pi",
        targets.extension?.onPress ?? targets.sheet,
      );
    case "subagents":
      return spec(
        BotMessageSquareIcon,
        counted(segment.count, "subagent", "subagents"),
        // A child request can come from an earlier turn or a side chat, which only Activity lists.
        segment.needsYou || targets.agents === null ? targets.sheet : targets.agents,
        targets.agentsLabel === undefined ? {} : { accessibilityLabel: targets.agentsLabel },
      );
    case "processes":
      return spec(
        ComputerTerminal01Icon,
        counted(segment.count, "process", "processes"),
        targets.sheet,
      );
    case "monitors":
      return spec(
        ComputerActivityIcon,
        segment.count === 1 ? "Monitoring" : `${segment.count} monitors`,
        targets.sheet,
      );
    case "backgroundGroup":
      return spec(
        SquareStackIcon,
        counted(segment.count, "background task", "background tasks"),
        targets.sheet,
        { filled: true, chevron: true },
      );
    case "queue":
      return spec(LeftToRightListNumberIcon, `${segment.count} queued`, targets.sheet);
    case "devices":
      return spec(
        SmartPhone01Icon,
        segment.count === 1 ? "Device" : `${segment.count} devices`,
        targets.devices ?? targets.sheet,
      );
    case "browser":
      return spec(
        Globe02Icon,
        segment.count === 1 ? "Browser" : `${segment.count} tabs`,
        targets.browser ?? targets.sheet,
      );
  }
}

/**
 * The thread's pull request on its state's tinted glass (palette.prPill), a stack or several as
 * the layers glyph with how many more, and a running or failing checks mark on an open one.
 */
function PullRequestPill(props: {
  readonly pr: ThreadPrPresentation;
  readonly look: No3yPullRequestPill;
  readonly palette: FlatGlassPalette;
  readonly onPress: () => void;
}) {
  const { pr, look, palette } = props;
  const colors = look.several ? { ink: palette.foreground } : palette.prPill[look.tone];
  const checks =
    look.checks === "pending"
      ? ", checks running"
      : look.checks === "failing"
        ? ", checks failing"
        : "";
  return (
    <Pill
      accessibilityLabel={`${pr.accessibilityLabel}${checks}`}
      onPress={props.onPress}
      palette={palette}
      tint={colors.tint}
      glow={look.several ? palette.prStackGlow : undefined}
    >
      <HugeIcon
        icon={look.several ? Layers01Icon : GitPullRequestIcon}
        filled={look.several}
        size={ICON_SIZE}
        color={colors.ink}
      />
      <PillText color={colors.ink}>{pr.number}</PillText>
      {look.several && look.more > 0 ? (
        <PillText color={colors.ink}>{`${look.more}+`}</PillText>
      ) : null}
      {look.checks === "pending" ? <ChecksRunningMark color={palette.statusAttention} /> : null}
      {look.checks === "failing" ? <ChecksFailingMark color={palette.statusFailed} /> : null}
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

/** The checks-failing mark: a solid dot the size of the running mark's inner pie. */
function ChecksFailingMark(props: { readonly color: string }) {
  return (
    <View
      style={{
        width: ICON_SIZE,
        height: ICON_SIZE,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={14} height={14} viewBox="0 0 14 14">
        <Circle cx={7} cy={7} r={4} fill={props.color} />
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
