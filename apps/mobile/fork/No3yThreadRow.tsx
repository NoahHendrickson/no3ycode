/**
 * Flat Glass thread card, slim shelf row, and pending draft row — matching the
 * Mac sidebar's `sidebar-v2-card-rows` & Flat Glass visual vocabulary while
 * preserving mobile swipe and context-menu actions.
 * See `.fork/customizations.yaml#no3y-mobile-redesign`.
 */
import {
  threadCardTitleRecedes,
  type SidebarV2CardStatusKind,
  type SidebarV2StatusBucket,
} from "./forkStatusGrouping";
import {
  formatWorkingDurationLabel,
  resolveThreadWorkingStartedAt,
} from "@t3tools/client-runtime/state/models";
import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import type { EnvironmentThreadSearchMatch } from "@t3tools/client-runtime/state/thread-search";
import { canSnooze } from "@t3tools/client-runtime/state/thread-settled";
import { threadChipCopyTarget } from "@t3tools/client-runtime/thread-reference";
import { AuthOrchestrationOperateScope, type EnvironmentMachineKind } from "@t3tools/contracts";
import type { SnoozePresetSetting } from "@t3tools/contracts/settings";
import type { MenuAction } from "@react-native-menu/menu";
import { memo, useCallback, useMemo, useState, type ComponentProps } from "react";
import { Platform, Pressable, Text as RNText, useWindowDimensions, View } from "react-native";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";

import { EnvironmentMachineSymbol } from "../src/components/EnvironmentMachineSymbol";
import { ProjectFavicon } from "../src/components/ProjectFavicon";
import {
  ProviderIcon,
  ProviderInstanceIcon,
  providerInstanceNameLabel,
} from "../src/components/ProviderIcon";
import { SymbolView } from "../src/components/ui/AppSymbol";
import { AppText as Text } from "../src/components/ui/AppText";
import * as Dialog from "../src/components/ui/Dialog";
import { Menu } from "../src/components/ui/Menu";
import { useNowAfter } from "../src/lib/clock";
import { copyTextWithHaptic } from "../src/lib/copyTextWithHaptic";
import { copyThreadReference } from "../src/lib/copyThreadReference";
import { appAtomRegistry } from "../src/state/atom-registry";
import { useEnvironmentScope } from "../src/state/session";
import type { ThreadListProvider } from "../src/state/thread-list-environments";
import { threadArrangementOpenAtom } from "../src/state/thread-order";
import {
  resolveThreadPrBadgeAction,
  type ThreadPrPresentation,
} from "../src/state/thread-pr-presentation";
import { threadEnvironment } from "../src/state/threads";
import { useAtomCommand } from "../src/state/use-atom-command";
import type { PendingNewTask } from "../src/state/use-pending-new-tasks";
import { useThreadPr } from "../src/state/use-thread-pr";
import { useSwipeRowDormant } from "../src/features/home/swipe-row-activation";
import { ThreadSwipeable } from "../src/features/home/thread-swipe-actions";
import { threadCanArchive } from "../src/features/home/threadArchive";
import { PullRequestGlyph } from "../src/features/pull-requests/pullRequestGlyphs";
import { pullRequestStatus } from "../src/features/pull-requests/pullRequestStatus";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { CustomSnoozeSheet } from "../src/features/threads/CustomSnoozeSheet";
import { QueuedMessageIcon } from "../src/features/threads/queued-message-icon";
import { THREAD_LIST_V2_MONO_FONT } from "../src/features/threads/thread-list-v2-row-appearance";
import type { ThreadRowProviderInstance } from "../src/features/threads/thread-provider-instance";
import { ThreadSearchMatchExcerpt } from "../src/features/threads/thread-search-match";
import { buildThreadTitleRegenerationMenuItems } from "../src/features/threads/thread-title-regeneration-menu";
import {
  layoutThreadListV2RowMenuActions,
  resolveThreadListV2ProviderDrivers,
  resolveThreadListV2SnoozeGateExpiryMs,
  resolveThreadListV2SnoozeMenuSelection,
  resolveThreadListV2SnoozePresets,
  resolveThreadListV2SwipeActions,
} from "../src/features/threads/threadListV2";
import type { ThreadMoveDestination } from "../src/features/threads/threadOrder";
import {
  canTurnThreadIntoProject,
  turnThreadIntoProject,
} from "../src/features/threads/turnThreadIntoProject";
import { useVisibleSecondClock } from "../src/features/threads/use-visible-second-clock";
import { flatGlassPalette } from "./flatGlassTheme";
import { No3yStatusMark } from "./No3yStatusMark";

const TABULAR_DURATION_STYLE = {
  fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
  fontVariant: ["tabular-nums"],
  fontSize: 12,
  lineHeight: 16,
} as const;

function WorkingElapsedText(props: { readonly startedAt: string | null; readonly color: string }) {
  const startedAtMs = Date.parse(props.startedAt ?? "");
  const nowMs = useVisibleSecondClock(Number.isFinite(startedAtMs));
  if (!Number.isFinite(startedAtMs)) return null;
  return (
    <RNText style={[TABULAR_DURATION_STYLE, { color: props.color }]}>
      {formatWorkingDurationLabel(nowMs - startedAtMs)}
    </RNText>
  );
}

const CARD_MENU_ACTIONS: MenuAction[] = [
  { id: "settle", title: "Settle", image: "checkmark" },
  { id: "delete", title: "Delete", image: "trash", attributes: { destructive: true } },
];

const SLIM_MENU_ACTIONS: MenuAction[] = [
  { id: "unsettle", title: "Un-settle", image: "arrow.uturn.backward" },
  { id: "delete", title: "Delete", image: "trash", attributes: { destructive: true } },
];

const SNOOZED_MENU_ACTIONS: MenuAction[] = [
  { id: "unsnooze", title: "Wake thread", image: "clock" },
  { id: "delete", title: "Delete", image: "trash", attributes: { destructive: true } },
];

const LEGACY_MENU_ACTIONS: MenuAction[] = [
  { id: "archive", title: "Archive", image: "archivebox" },
  { id: "delete", title: "Delete", image: "trash", attributes: { destructive: true } },
];

export const No3yPendingDraftRow = memo(function No3yPendingDraftRow(props: {
  readonly pendingTask: PendingNewTask;
  readonly selected: boolean;
  readonly project: EnvironmentProject | null;
  readonly projectTitle?: string | undefined;
  readonly environmentLabel: string | null;
  readonly onSelectPendingTask: (pendingTask: PendingNewTask) => void;
  readonly onDeletePendingTask: (pendingTask: PendingNewTask) => void;
}) {
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const { pendingTask, selected } = props;

  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 1 }}>
      <Menu
        actions={[
          { id: "open", title: "Open draft", image: "square.and.pencil" },
          {
            id: "delete",
            title: "Delete draft",
            image: "trash",
            attributes: { destructive: true },
          },
        ]}
        shouldOpenOnLongPress
        onPressAction={({ nativeEvent }) => {
          if (nativeEvent.event === "open") props.onSelectPendingTask(pendingTask);
          if (nativeEvent.event === "delete") props.onDeletePendingTask(pendingTask);
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${pendingTask.title}, Draft`}
          accessibilityState={{ selected }}
          onPress={() => props.onSelectPendingTask(pendingTask)}
          style={({ pressed }) => ({
            borderRadius: 16,
            paddingHorizontal: 12,
            paddingVertical: 9,
            backgroundColor: selected
              ? palette.rowSelected
              : pressed
                ? palette.rowPressed
                : "transparent",
          })}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                fontSize: 14,
                lineHeight: 18,
                fontWeight: "400",
                color: selected ? palette.foreground : palette.quietInk,
              }}
            >
              {pendingTask.title}
            </Text>
            <No3yStatusMark kind={null} seed={pendingTask.key} palette={palette} idleMode="draft" />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
            {props.project ? (
              <ProjectFavicon
                environmentId={pendingTask.environmentId}
                faviconPath={props.project.faviconPath}
                projectIcon={props.project.projectIcon}
                size={13}
                projectTitle={props.project.title}
                workspaceRoot={props.project.workspaceRoot}
              />
            ) : null}
            <Text
              numberOfLines={1}
              style={{ flex: 1, fontSize: 12, lineHeight: 16, color: palette.quietInk }}
            >
              {[props.projectTitle ?? props.project?.title, props.environmentLabel]
                .filter(Boolean)
                .join(" · ") || "Draft"}
            </Text>
          </View>
        </Pressable>
      </Menu>
    </View>
  );
});

export const No3yThreadRow = memo(function No3yThreadRow(props: {
  readonly thread: EnvironmentThreadShell;
  readonly variant: "card" | "slim";
  readonly statusKind: SidebarV2CardStatusKind | null;
  readonly statusSection: SidebarV2StatusBucket | undefined;
  readonly selected: boolean;
  readonly snoozed: boolean;
  readonly pinned: boolean;
  readonly wokeAt: string | null;
  readonly hasQueuedMessages: boolean;
  readonly snoozePresetMinute: string;
  readonly snoozeWakeLabelText?: string | undefined;
  readonly timeLabel: string;
  readonly project: EnvironmentProject | null;
  readonly providerInstance: ThreadRowProviderInstance | null;
  readonly providers?: ReadonlyArray<ThreadListProvider> | undefined;
  readonly environmentLabel: string | null;
  readonly environmentMachine?: EnvironmentMachineKind | undefined;
  readonly searchMatch?: EnvironmentThreadSearchMatch | undefined;
  readonly searchQuery?: string | undefined;
  readonly fullSwipeWidth?: number | undefined;
  readonly settlementSupported: boolean;
  readonly snoozeSupported: boolean;
  readonly snoozePresets: ReadonlyArray<SnoozePresetSetting> | undefined;
  readonly pinningSupported: boolean;
  readonly autoSettleOptOutSupported: boolean;
  readonly titleRegenerationSupported: boolean;
  readonly reorderSupported?: boolean | undefined;
  readonly canMoveUp?: boolean | undefined;
  readonly canMoveDown?: boolean | undefined;
  readonly activationKey?: string | undefined;
  readonly simultaneousSwipeGesture?: ComponentProps<typeof ThreadSwipeable>["simultaneousWith"];
  readonly onSelectThread: (thread: EnvironmentThreadShell) => void;
  readonly onOpenThreadPullRequests: (
    thread: EnvironmentThreadShell,
    pr: ThreadPrPresentation,
  ) => void;
  readonly onDeleteThread: (thread: EnvironmentThreadShell) => void;
  readonly onArchiveThread: (thread: EnvironmentThreadShell) => void;
  readonly onRenameThread: (thread: EnvironmentThreadShell) => void;
  readonly onRegenerateThreadTitle: (thread: EnvironmentThreadShell) => void;
  readonly onNewThreadOnBranch: (thread: EnvironmentThreadShell) => void;
  readonly onSettleThread: (thread: EnvironmentThreadShell) => void;
  readonly onSnoozeThread: (thread: EnvironmentThreadShell, snoozedUntil: string) => void;
  readonly onUnsnoozeThread: (thread: EnvironmentThreadShell) => void;
  readonly onUnsettleThread: (thread: EnvironmentThreadShell) => void;
  readonly onPinThread: (thread: EnvironmentThreadShell) => void;
  readonly onUnpinThread: (thread: EnvironmentThreadShell) => void;
  readonly onSetThreadAutoSettle: (thread: EnvironmentThreadShell, enabled: boolean) => void;
  readonly onMoveThread?: (
    thread: EnvironmentThreadShell,
    direction: ThreadMoveDestination,
  ) => void;
  readonly onSwipeableWillOpen: (methods: SwipeableMethods) => void;
  readonly onSwipeableClose: (methods: SwipeableMethods) => void;
}) {
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const { width: windowWidth } = useWindowDimensions();
  const {
    thread,
    variant,
    statusKind,
    statusSection,
    selected,
    snoozed,
    pinned,
    onSelectThread,
    onOpenThreadPullRequests,
    onDeleteThread,
    onArchiveThread,
    onRenameThread,
    onRegenerateThreadTitle,
    onNewThreadOnBranch,
    onSettleThread,
    onSnoozeThread,
    onUnsnoozeThread,
    onUnsettleThread,
    onPinThread,
    onUnpinThread,
    onSetThreadAutoSettle,
    onMoveThread,
  } = props;
  const dormant = useSwipeRowDormant(props.activationKey);
  const canOperateThread = useEnvironmentScope(thread.environmentId, AuthOrchestrationOperateScope);
  const pr = useThreadPr(thread);
  const visitThread = useAtomCommand(threadEnvironment.visit, { reportFailure: false });
  const [customSnoozeOpen, setCustomSnoozeOpen] = useState(false);

  const rowIdentity = `${thread.environmentId}:${thread.id}`;
  const [boundIdentity, setBoundIdentity] = useState(rowIdentity);
  if (boundIdentity !== rowIdentity) {
    setBoundIdentity(rowIdentity);
    setCustomSnoozeOpen(false);
  }

  const { providerDrivers, providerIconUrl } = useMemo(() => {
    const provider = props.providers?.find(
      (candidate) =>
        candidate.instanceId ===
        (thread.runtime?.providerInstanceId ?? thread.modelSelection.instanceId),
    );
    return {
      providerDrivers: resolveThreadListV2ProviderDrivers(thread, props.providers),
      providerIconUrl: provider?.iconUrl,
    };
  }, [thread, props.providers]);

  const providerNameLabel = props.providerInstance
    ? providerInstanceNameLabel({
        provider: props.providerInstance.driverKind,
        iconUrl: providerIconUrl,
        displayName: props.providerInstance.displayName,
        showBadge: props.providerInstance.showBadge,
      })
    : null;

  const titleRecedes = threadCardTitleRecedes({
    isDone: statusKind === "done" || statusKind === "woke",
    isIdle: statusKind === null || statusKind === "monitoring",
    isActive: selected,
    isSelected: selected,
    statusSection,
  });

  const handleOpenPullRequests = useCallback(() => {
    if (pr) onOpenThreadPullRequests(thread, pr);
  }, [onOpenThreadPullRequests, pr, thread]);

  const handleAcknowledgeWoke = useCallback(() => {
    if (props.wokeAt === null) return;
    void visitThread({
      environmentId: thread.environmentId,
      input: { threadId: thread.id, visitedAt: props.wokeAt },
    });
  }, [props.wokeAt, thread.environmentId, thread.id, visitThread]);

  const snoozeGateExpiryMs = props.snoozeSupported
    ? resolveThreadListV2SnoozeGateExpiryMs(thread, { now: thread.latestUserMessageAt ?? "" })
    : null;
  const snoozeGateNowMs = useNowAfter(snoozeGateExpiryMs === null ? null : snoozeGateExpiryMs + 1);
  const snoozeGateNow = new Date(snoozeGateNowMs).toISOString();
  const swipeActions = resolveThreadListV2SwipeActions({
    variant,
    settlementSupported: props.settlementSupported,
    snoozeSupported: props.snoozeSupported,
    snoozable: canSnooze(thread, { now: snoozeGateNow }),
    snoozed,
  });
  const snoozePresets = resolveThreadListV2SnoozePresets({
    secondary: swipeActions.secondary,
    now: props.snoozePresetMinute || snoozeGateNow,
    presets: props.snoozePresets,
  });
  const snoozePresetActions = useMemo<MenuAction[]>(
    () => [
      ...snoozePresets.map((preset) => ({
        id: `snooze:${preset.id}`,
        title: preset.label,
        subtitle: preset.whenLabel,
      })),
      { id: "snooze:custom", title: "Custom…" },
    ],
    [snoozePresets],
  );

  const isRegeneratingTitle = thread.titleRegeneration != null;
  const canTurnIntoProject = canTurnThreadIntoProject(thread);
  const menuActions = useMemo<MenuAction[]>(() => {
    const nested = Platform.OS === "ios";
    const direct: MenuAction[] = [
      ...(thread.branch
        ? [
            {
              id: "new-thread-on-branch",
              title: "New thread on branch",
              image: "square.and.pencil",
            },
          ]
        : []),
      { id: "copy-thread", title: "Copy thread", image: "text.bubble" },
      { id: "copy-thread-id", title: "Copy thread ID", image: "doc.on.doc" },
    ];
    const pin: MenuAction[] = props.pinningSupported
      ? [
          thread.pinnedAt != null
            ? { id: "unpin", title: "Unpin", image: "pin.slash" }
            : { id: "pin", title: "Pin", image: "pin" },
        ]
      : [];
    const reorder: MenuAction[] =
      props.reorderSupported === true
        ? [
            { id: "arrange", title: "Arrange threads…", image: "line.3.horizontal" },
            {
              id: "move-up",
              title: "Move up",
              image: "arrow.up",
              attributes: { disabled: props.canMoveUp !== true },
            },
            {
              id: "move-down",
              title: "Move down",
              image: "arrow.down",
              attributes: { disabled: props.canMoveDown !== true },
            },
          ]
        : [];
    const titleItems: MenuAction[] = [
      { id: "rename", title: "Rename", image: "square.and.pencil" },
      ...buildThreadTitleRegenerationMenuItems({
        supported: props.titleRegenerationSupported,
        isRegenerating: isRegeneratingTitle,
      }),
      ...(canTurnIntoProject
        ? [
            {
              id: "turn-into-project",
              title: "Turn into project",
              image: "folder.badge.plus",
              attributes: { disabled: !threadCanArchive(thread.runtime) },
            },
          ]
        : []),
    ];
    const autoSettle: MenuAction[] = props.autoSettleOptOutSupported
      ? [
          {
            id: "auto-settle",
            title: "Auto-settle behavior",
            image: "timer",
            subactions: [
              {
                id: "auto-settle:enabled",
                title: "Follow settings",
                state: thread.autoSettleDisabledAt == null ? "on" : "off",
              },
              {
                id: "auto-settle:disabled",
                title: "Never",
                state: thread.autoSettleDisabledAt == null ? "off" : "on",
              },
            ],
          },
        ]
      : [];
    if (snoozed) {
      return layoutThreadListV2RowMenuActions({
        nested,
        direct: [...direct, SNOOZED_MENU_ACTIONS[0]!],
        reorder: [],
        pin: [],
        secondary: [
          ...titleItems,
          ...autoSettle,
          LEGACY_MENU_ACTIONS[0]!,
          SNOOZED_MENU_ACTIONS[1]!,
        ],
      });
    }
    if (!props.settlementSupported) {
      return layoutThreadListV2RowMenuActions({
        nested,
        direct: [...direct, LEGACY_MENU_ACTIONS[0]!],
        reorder,
        pin,
        secondary: [...titleItems, LEGACY_MENU_ACTIONS[1]!],
      });
    }
    if (variant === "slim") {
      return layoutThreadListV2RowMenuActions({
        nested,
        direct: [...direct, SLIM_MENU_ACTIONS[0]!],
        reorder: [],
        pin,
        secondary: [...titleItems, ...autoSettle, LEGACY_MENU_ACTIONS[0]!, SLIM_MENU_ACTIONS[1]!],
      });
    }
    return layoutThreadListV2RowMenuActions({
      nested,
      direct: [
        ...direct,
        CARD_MENU_ACTIONS[0]!,
        ...(swipeActions.secondary === "snooze"
          ? [{ id: "snooze", title: "Snooze", image: "clock", subactions: snoozePresetActions }]
          : []),
      ],
      reorder,
      pin,
      secondary: [...titleItems, ...autoSettle, LEGACY_MENU_ACTIONS[0]!, CARD_MENU_ACTIONS[1]!],
    });
  }, [
    canTurnIntoProject,
    isRegeneratingTitle,
    props.autoSettleOptOutSupported,
    props.canMoveDown,
    props.canMoveUp,
    props.pinningSupported,
    props.reorderSupported,
    props.settlementSupported,
    props.titleRegenerationSupported,
    snoozePresetActions,
    snoozed,
    swipeActions.secondary,
    thread.autoSettleDisabledAt,
    thread.branch,
    thread.pinnedAt,
    thread.runtime,
    variant,
  ]);

  const handleMenuAction = useCallback(
    ({ nativeEvent }: { readonly nativeEvent: { readonly event: string } }) => {
      const event = nativeEvent.event;
      if (event === "new-thread-on-branch") onNewThreadOnBranch(thread);
      else if (event === "settle") onSettleThread(thread);
      else if (event === "unsettle") onUnsettleThread(thread);
      else if (event === "unsnooze") onUnsnoozeThread(thread);
      else if (event === "pin") onPinThread(thread);
      else if (event === "unpin") onUnpinThread(thread);
      else if (event === "auto-settle:enabled") onSetThreadAutoSettle(thread, true);
      else if (event === "auto-settle:disabled") onSetThreadAutoSettle(thread, false);
      else if (event === "arrange") appAtomRegistry.set(threadArrangementOpenAtom, true);
      else if (event === "move-up") onMoveThread?.(thread, "up");
      else if (event === "move-down") onMoveThread?.(thread, "down");
      else if (event === "archive") onArchiveThread(thread);
      else if (event === "rename") onRenameThread(thread);
      else if (event === "regenerate-title") onRegenerateThreadTitle(thread);
      else if (event === "turn-into-project") void turnThreadIntoProject(thread);
      else if (event === "copy-thread") {
        const target = threadChipCopyTarget(
          { environmentId: thread.environmentId, threadId: thread.id },
          thread.title,
        );
        void copyThreadReference(target).then((didCopy) => {
          if (!didCopy) Dialog.alert(target.failureTitle, "Try copying this thread again.");
        });
      } else if (event === "copy-thread-id") {
        copyTextWithHaptic(thread.id, { target: "thread-id" });
      } else if (event === "delete") onDeleteThread(thread);
      else if (event === "snooze:custom") setCustomSnoozeOpen(true);
      else {
        const selection = resolveThreadListV2SnoozeMenuSelection({
          event,
          displayedPresets: snoozePresets,
          now: new Date(),
          presets: props.snoozePresets,
        });
        if (selection._tag === "selected") onSnoozeThread(thread, selection.preset.snoozedUntil);
        else if (selection._tag === "expired") {
          Dialog.alert(
            "Could not snooze thread",
            "That snooze time has passed. Choose another time.",
          );
        }
      }
    },
    [
      onArchiveThread,
      onDeleteThread,
      onMoveThread,
      onNewThreadOnBranch,
      onPinThread,
      onRegenerateThreadTitle,
      onRenameThread,
      onSetThreadAutoSettle,
      onSettleThread,
      onSnoozeThread,
      onUnpinThread,
      onUnsettleThread,
      onUnsnoozeThread,
      props.snoozePresets,
      snoozePresets,
      thread,
    ],
  );

  const primaryAction = useMemo(() => {
    if (swipeActions.primary === "archive") {
      return {
        accessibilityLabel: `Archive ${thread.title}`,
        icon: "archivebox" as const,
        label: "Archive",
        onPress: () => onArchiveThread(thread),
      };
    }
    if (swipeActions.primary === "unsnooze") {
      return {
        accessibilityLabel: `Wake ${thread.title} now`,
        icon: "clock" as const,
        label: "Wake",
        onPress: () => onUnsnoozeThread(thread),
      };
    }
    return swipeActions.primary === "unsettle"
      ? {
          accessibilityLabel: `Un-settle ${thread.title}`,
          icon: "arrow.uturn.backward" as const,
          label: "Un-settle",
          onPress: () => onUnsettleThread(thread),
        }
      : {
          accessibilityLabel: `Settle ${thread.title}`,
          icon: "checkmark" as const,
          label: "Settle",
          onPress: () => onSettleThread(thread),
        };
  }, [
    onArchiveThread,
    onSettleThread,
    onUnsettleThread,
    onUnsnoozeThread,
    swipeActions.primary,
    thread,
  ]);

  const secondaryAction = useMemo(
    () =>
      swipeActions.secondary === "snooze"
        ? {
            accessibilityLabel: `Choose when to snooze ${thread.title}`,
            icon: "clock" as const,
            label: "Snooze",
            menu: {
              actions: snoozePresetActions,
              onPressAction: handleMenuAction,
              title: "Snooze until",
            },
            onPress: () => undefined,
          }
        : null,
    [handleMenuAction, snoozePresetActions, swipeActions.secondary, thread.title],
  );

  const prBadgeLabel = pr ? resolveThreadPrBadgeAction(pr).accessibilityLabel : null;
  const isSlim = variant === "slim";

  const renderPressable = (close: () => void) => (
    <View style={{ paddingHorizontal: 8, paddingVertical: isSlim ? 0.5 : 1 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={thread.title}
        accessibilityState={{ selected }}
        onPress={() => {
          close();
          onSelectThread(thread);
        }}
        style={({ pressed }) => ({
          borderRadius: isSlim ? 8 : 16,
          paddingHorizontal: 12,
          paddingVertical: isSlim ? 8 : 9,
          backgroundColor: selected
            ? palette.rowSelected
            : pressed
              ? palette.rowPressed
              : "transparent",
        })}
      >
        {isSlim ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {props.project ? (
              <View style={{ opacity: 0.45 }}>
                <ProjectFavicon
                  environmentId={thread.environmentId}
                  faviconPath={props.project.faviconPath}
                  projectIcon={props.project.projectIcon}
                  size={14}
                  projectTitle={props.project.title}
                  workspaceRoot={props.project.workspaceRoot}
                />
              </View>
            ) : null}
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                fontSize: 14,
                lineHeight: 18,
                fontWeight: "400",
                color: selected ? palette.foreground : palette.quietInk,
                opacity: isRegeneratingTitle ? 0.55 : 1,
              }}
            >
              {thread.title}
            </Text>
            {props.hasQueuedMessages ? <QueuedMessageIcon selected={selected} /> : null}
            <Text
              style={{
                fontSize: 12,
                lineHeight: 16,
                fontVariant: ["tabular-nums"],
                color: palette.faintInk,
                fontFamily: THREAD_LIST_V2_MONO_FONT,
              }}
            >
              {snoozed && props.snoozeWakeLabelText !== undefined
                ? props.snoozeWakeLabelText
                : props.timeLabel}
            </Text>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  fontSize: 14,
                  lineHeight: 18,
                  fontWeight: "400",
                  color: titleRecedes ? palette.quietInk : palette.foreground,
                  opacity: isRegeneratingTitle ? 0.55 : 1,
                }}
              >
                {thread.title}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {props.hasQueuedMessages ? <QueuedMessageIcon selected={selected} /> : null}
                {statusKind === "working" ? (
                  <WorkingElapsedText
                    startedAt={resolveThreadWorkingStartedAt(thread)}
                    color={palette.faintInk}
                  />
                ) : props.timeLabel ? (
                  <Text
                    style={{
                      fontSize: 12,
                      lineHeight: 16,
                      fontVariant: ["tabular-nums"],
                      color: palette.faintInk,
                    }}
                  >
                    {props.timeLabel}
                  </Text>
                ) : null}
                {pinned ? (
                  <SymbolView name="pin" size={10} tintColor={palette.faintInk} type="monochrome" />
                ) : null}
                {statusKind === "woke" && props.wokeAt !== null ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss Woke notification"
                    hitSlop={8}
                    onPress={handleAcknowledgeWoke}
                  >
                    <No3yStatusMark
                      kind="woke"
                      seed={rowIdentity}
                      palette={palette}
                      idleMode="dot"
                    />
                  </Pressable>
                ) : (
                  <No3yStatusMark
                    kind={statusKind}
                    seed={rowIdentity}
                    palette={palette}
                    idleMode="dot"
                  />
                )}
              </View>
            </View>
            {props.searchMatch ? (
              <View style={{ marginTop: 4 }}>
                <ThreadSearchMatchExcerpt
                  sidebar={false}
                  match={props.searchMatch}
                  query={props.searchQuery ?? ""}
                  selected={selected}
                />
              </View>
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
              {props.project ? (
                <ProjectFavicon
                  environmentId={thread.environmentId}
                  faviconPath={props.project.faviconPath}
                  projectIcon={props.project.projectIcon}
                  size={13}
                  projectTitle={props.project.title}
                  workspaceRoot={props.project.workspaceRoot}
                />
              ) : null}
              <View
                style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 5, minWidth: 0 }}
              >
                {(statusKind === "failed" || statusKind === "limited") &&
                thread.runtime?.lastError ? (
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      fontSize: 12,
                      lineHeight: 16,
                      color:
                        statusKind === "limited" ? palette.statusAttention : palette.statusFailed,
                    }}
                  >
                    {thread.runtime.lastError}
                  </Text>
                ) : (
                  <>
                    <Text
                      numberOfLines={1}
                      style={{
                        flexShrink: 1,
                        fontSize: 12,
                        lineHeight: 16,
                        color: palette.quietInk,
                      }}
                    >
                      {props.project?.title ?? "No project"}
                    </Text>
                    {thread.branch ? (
                      <>
                        <Text style={{ fontSize: 12, color: palette.faintInk }}>·</Text>
                        <Text
                          numberOfLines={1}
                          style={{
                            flexShrink: 1,
                            fontSize: 12,
                            lineHeight: 16,
                            color: palette.faintInk,
                          }}
                        >
                          {thread.branch}
                        </Text>
                      </>
                    ) : null}
                    {props.environmentLabel ? (
                      <>
                        <Text style={{ fontSize: 12, color: palette.faintInk }}>·</Text>
                        {props.environmentMachine ? (
                          <EnvironmentMachineSymbol
                            kind={props.environmentMachine}
                            size={11}
                            tintColorClassName="accent-foreground-muted"
                          />
                        ) : null}
                        <Text
                          numberOfLines={1}
                          style={{
                            flexShrink: 1,
                            fontSize: 12,
                            lineHeight: 16,
                            color: palette.faintInk,
                          }}
                        >
                          {props.environmentLabel}
                        </Text>
                      </>
                    ) : null}
                  </>
                )}
              </View>
              {pr ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={prBadgeLabel ?? undefined}
                  hitSlop={6}
                  onPress={handleOpenPullRequests}
                  onLongPress={() => undefined}
                  style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
                >
                  <SymbolView
                    name={
                      pr.kind === "stack"
                        ? PullRequestGlyph.stack
                        : pr.state === null
                          ? PullRequestGlyph.pullRequest
                          : pullRequestStatus({ state: pr.state, isDraft: pr.isDraft }).icon
                    }
                    size={11}
                    tintColor={palette.quietInk}
                  />
                  <Text
                    style={{
                      fontSize: 11,
                      lineHeight: 14,
                      color: palette.quietInk,
                      fontFamily: THREAD_LIST_V2_MONO_FONT,
                    }}
                  >
                    {pr.label}
                  </Text>
                </Pressable>
              ) : null}
              {props.providerInstance ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  {providerDrivers.slice(0, -1).map((driver, index) => (
                    /* oxlint-disable-next-line react/no-array-index-key -- decorative driver history icons */
                    <View key={`${driver}:${index}`} style={{ marginRight: -4, opacity: 0.3 }}>
                      <ProviderIcon provider={driver} size={11} />
                    </View>
                  ))}
                  <ProviderInstanceIcon
                    iconUrl={providerIconUrl}
                    provider={props.providerInstance.driverKind}
                    size={13}
                    displayName={props.providerInstance.displayName}
                    accentColor={props.providerInstance.accentColor}
                    showBadge={props.providerInstance.showBadge}
                    surfaceColor={palette.stageBackground}
                  />
                  {providerNameLabel ? (
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="middle"
                      style={{
                        maxWidth: 96,
                        fontSize: 12,
                        lineHeight: 16,
                        color: palette.faintInk,
                      }}
                    >
                      {providerNameLabel}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </>
        )}
      </Pressable>
    </View>
  );

  if (!canOperateThread) return renderPressable(() => {});

  return (
    <View collapsable={false}>
      {customSnoozeOpen ? (
        <CustomSnoozeSheet
          onClose={() => setCustomSnoozeOpen(false)}
          onSnooze={(until) => onSnoozeThread(thread, until)}
        />
      ) : null}
      <ThreadSwipeable
        dormant={dormant}
        threadKey={rowIdentity}
        backgroundColor={palette.stageBackground}
        compactActions={isSlim}
        enableTrackpadSwipe
        fullSwipeAction="primary"
        fullSwipeWidth={props.fullSwipeWidth ?? windowWidth - 32}
        onDelete={() => onDeleteThread(thread)}
        onSwipeableClose={props.onSwipeableClose}
        onSwipeableWillOpen={props.onSwipeableWillOpen}
        primaryAction={primaryAction}
        secondaryAction={secondaryAction}
        resetKey={`${rowIdentity}:${variant}:${snoozed}:${thread.settledAt}:${thread.unsettledAt}:${thread.snoozedUntil}:${thread.pinnedAt}`}
        simultaneousWith={props.simultaneousSwipeGesture}
        threadTitle={thread.title}
      >
        {(close) => (
          <Menu actions={menuActions} onPressAction={handleMenuAction} shouldOpenOnLongPress>
            {renderPressable(close)}
          </Menu>
        )}
      </ThreadSwipeable>
    </View>
  );
});
