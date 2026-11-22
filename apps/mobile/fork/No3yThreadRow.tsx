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
import { Platform, Pressable, useWindowDimensions, View } from "react-native";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";

import { ProviderInstanceIcon } from "../src/components/ProviderIcon";
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
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { CustomSnoozeSheet } from "../src/features/threads/CustomSnoozeSheet";
import { QueuedMessageIcon } from "../src/features/threads/queued-message-icon";
import type { ThreadRowProviderInstance } from "../src/features/threads/thread-provider-instance";
import { ThreadSearchMatchExcerpt } from "../src/features/threads/thread-search-match";
import { buildThreadTitleRegenerationMenuItems } from "../src/features/threads/thread-title-regeneration-menu";
import {
  layoutThreadListV2RowMenuActions,
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
import GitPullRequestIcon from "@hugeicons/core-free-icons/GitPullRequestIcon";
import { formatModelSlugName } from "@t3tools/shared/model";
import { flatGlassPalette, NO3Y_FONT } from "./flatGlassTheme";
import { HugeIcon } from "./HugeIcon";
import { No3yStatusMark } from "./No3yStatusMark";

/** "claude-opus-5-5" reads "Opus 5.5": the provider mark beside it already names the family. */
function no3yModelLabel(model: string): string {
  return formatModelSlugName(model).replace(/^Claude /, "");
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
    <View style={{ paddingHorizontal: 10 }}>
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
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            borderRadius: 8,
            paddingLeft: 8,
            paddingRight: 10,
            paddingVertical: 8,
            backgroundColor: selected
              ? palette.rowSelected
              : pressed
                ? palette.rowPressed
                : "transparent",
          })}
        >
          <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: NO3Y_FONT.regular,
                fontSize: 16,
                lineHeight: 18,
                color: selected ? palette.foreground : palette.quietInk,
              }}
            >
              {pendingTask.title}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: NO3Y_FONT.regular,
                fontSize: 14,
                lineHeight: 16,
                color: palette.metaInk,
              }}
            >
              {[props.projectTitle ?? props.project?.title, props.environmentLabel]
                .filter(Boolean)
                .join(" · ") || "Draft"}
            </Text>
          </View>
          <No3yStatusMark kind={null} palette={palette} idleMode="draft" />
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

  const providerIconUrl = props.providers?.find(
    (candidate) =>
      candidate.instanceId ===
      (thread.runtime?.providerInstanceId ?? thread.modelSelection.instanceId),
  )?.iconUrl;

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
  const prColor = pr?.state === "open" || pr?.state === null ? palette.prOpen : palette.metaInk;
  const isSlim = variant === "slim";

  const renderPressable = (close: () => void) => (
    <View style={{ paddingHorizontal: 10 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={thread.title}
        accessibilityState={{ selected }}
        onPress={() => {
          close();
          onSelectThread(thread);
        }}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          borderRadius: 8,
          paddingLeft: 8,
          paddingRight: 10,
          paddingVertical: 8,
          backgroundColor: selected
            ? palette.rowSelected
            : pressed
              ? palette.rowPressed
              : "transparent",
        })}
      >
        {isSlim ? (
          <>
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                fontFamily: NO3Y_FONT.regular,
                fontSize: 14,
                lineHeight: 18,
                color: selected ? palette.foreground : palette.metaInk,
                opacity: isRegeneratingTitle ? 0.55 : 1,
              }}
            >
              {thread.title}
            </Text>
            {props.hasQueuedMessages ? <QueuedMessageIcon selected={selected} /> : null}
            <Text
              style={{
                fontFamily: NO3Y_FONT.regular,
                fontSize: 12,
                lineHeight: 16,
                fontVariant: ["tabular-nums"],
                color: palette.faintInk,
              }}
            >
              {snoozed && props.snoozeWakeLabelText !== undefined
                ? props.snoozeWakeLabelText
                : props.timeLabel}
            </Text>
          </>
        ) : (
          <>
            <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: NO3Y_FONT.regular,
                  fontSize: 16,
                  lineHeight: 18,
                  color: titleRecedes ? palette.quietInk : palette.foreground,
                  opacity: isRegeneratingTitle ? 0.55 : 1,
                }}
              >
                {thread.title}
              </Text>
              {props.searchMatch ? (
                <ThreadSearchMatchExcerpt
                  sidebar={false}
                  match={props.searchMatch}
                  query={props.searchQuery ?? ""}
                  selected={selected}
                />
              ) : null}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  height: 16,
                  overflow: "hidden",
                }}
              >
                {(statusKind === "failed" || statusKind === "limited") &&
                thread.runtime?.lastError ? (
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      fontFamily: NO3Y_FONT.regular,
                      fontSize: 14,
                      lineHeight: 16,
                      color:
                        statusKind === "limited" ? palette.statusAttention : palette.statusFailed,
                    }}
                  >
                    {thread.runtime.lastError}
                  </Text>
                ) : (
                  <>
                    {pr ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={prBadgeLabel ?? undefined}
                        hitSlop={6}
                        onPress={handleOpenPullRequests}
                        onLongPress={() => undefined}
                        style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                      >
                        <HugeIcon
                          icon={GitPullRequestIcon}
                          size={12}
                          color={prColor}
                          strokeWidth={1.5}
                        />
                        <Text
                          style={{
                            fontFamily: NO3Y_FONT.regular,
                            fontSize: 12,
                            lineHeight: 16,
                            color: prColor,
                          }}
                        >
                          {pr.label}
                        </Text>
                      </Pressable>
                    ) : null}
                    {props.providerInstance ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <ProviderInstanceIcon
                          iconUrl={providerIconUrl}
                          provider={props.providerInstance.driverKind}
                          size={14}
                          displayName={props.providerInstance.displayName}
                          accentColor={props.providerInstance.accentColor}
                          showBadge={props.providerInstance.showBadge}
                          surfaceColor={palette.stageBackground}
                        />
                        <Text
                          numberOfLines={1}
                          style={{
                            maxWidth: 120,
                            fontFamily: NO3Y_FONT.regular,
                            fontSize: 14,
                            lineHeight: 15,
                            color: palette.metaInk,
                          }}
                        >
                          {no3yModelLabel(thread.modelSelection.model)}
                        </Text>
                      </View>
                    ) : null}
                    <Text
                      numberOfLines={1}
                      style={{
                        flexShrink: 1,
                        fontFamily: NO3Y_FONT.regular,
                        fontSize: 14,
                        lineHeight: 16,
                        color: palette.metaInk,
                      }}
                    >
                      {props.project?.title ?? "No project"}
                    </Text>
                  </>
                )}
              </View>
            </View>
            {props.hasQueuedMessages ? <QueuedMessageIcon selected={selected} /> : null}
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
                <No3yStatusMark kind="woke" palette={palette} idleMode="dot" />
              </Pressable>
            ) : (
              <No3yStatusMark kind={statusKind} palette={palette} idleMode="dot" />
            )}
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
