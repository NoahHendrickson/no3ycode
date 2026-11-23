/** Flat Glass status-grouped Threads list for iOS (`.fork/customizations.yaml#no3y-mobile-redesign`). */
import type { LegendListRef } from "@legendapp/list/react-native";
import { AnimatedLegendList } from "@legendapp/list/reanimated";
import { pickableProjectGroups } from "@t3tools/client-runtime/state/project-grouping";
import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import {
  threadSearchMatchKey,
  type EnvironmentThreadSearchMatch,
} from "@t3tools/client-runtime/state/thread-search";
import type { EnvironmentId } from "@t3tools/contracts";
import type { SnoozePresetSetting } from "@t3tools/contracts/settings";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Platform,
  ScrollView,
  View,
  type GestureResponderEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from "react-native";
import { GestureDetector, useNativeGesture } from "react-native-gesture-handler";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "../src/components/ui/EmptyState";
import { ScreenContent } from "../src/components/ui/ScreenContent";
import { useContentTopInset } from "../src/components/ui/useBarInset";
import { useWorkspaceTabs } from "../src/features/layout/workspace/WorkspaceTabsContext";
import { useSearchScrollRestoration } from "../src/features/layout/workspace/useSearchScrollRestoration";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { ThreadListV2ShowMoreRow } from "../src/features/threads/thread-list-v2-items";
import { useThreadRowProviderInstanceResolver } from "../src/features/threads/thread-provider-instance";
import { THREAD_LIST_ROW_LAYOUT } from "../src/features/threads/threadListAnimations";
import {
  THREAD_LIST_V2_SETTLED_INITIAL_COUNT,
  THREAD_LIST_V2_SETTLED_PAGE_COUNT,
} from "../src/features/threads/threadListV2";
import type { ThreadMoveDestination } from "../src/features/threads/threadOrder";
import { requestThreadMessageJump } from "../src/features/threads/threadMessageJump";
import { useThreadListV2ShelfPreferences } from "../src/features/threads/use-thread-list-v2-shelf-preferences";
import { useOpenThreadPullRequests } from "../src/features/threads/use-open-thread-pull-requests";
import { useFabScroll } from "../src/features/home/FabScrollContext";
import {
  holdLaunchSplashForHomeRows,
  settleLaunchSplashHomeRows,
} from "../src/features/home/home-launch-splash";
import type { HomeListFilterMenuEnvironment } from "../src/features/home/home-list-filter-menu";
import type { HomeProjectScope } from "../src/features/home/homeThreadList";
import { createSwipeRowActivation } from "../src/features/home/swipe-row-activation";
import {
  SwipeableScrollGateProvider,
  useSwipeableScrollGate,
} from "../src/features/home/thread-swipe-actions";
import type { SavedRemoteConnection } from "../src/lib/connection";
import { scopedProjectKey, scopedThreadKey } from "../src/lib/scopedEntities";
import { NativeScrollViewMarker } from "../src/native/NativeScrollViewMarker";
import { nativeHeaderScrollEdgeEffects } from "../src/native/scrollEdgeEffects";
import { useActiveNewTask } from "../src/state/active-new-task";
import type { ThreadListProvider } from "../src/state/thread-list-environments";
import type { ThreadPrPresentation } from "../src/state/thread-pr-presentation";
import { usePendingThreadOrder } from "../src/state/thread-order";
import type { PendingNewTask } from "../src/state/use-pending-new-tasks";
import type { WorkspaceEnvironment } from "../src/state/workspaceModel";
import { flatGlassPalette } from "./flatGlassTheme";
import {
  no3yStatusGroupedItemsAreEqual,
  type No3yStatusFilter,
  type No3yStatusGroupedListItem,
  type No3yThreadSortOrder,
} from "./mobileStatusGrouping";
import { useNo3yBottomNavEnabled } from "./no3yBottomNavEnabled";
import { No3yBottomTray, useNo3yTrayContentInset } from "./No3yBottomTray";
import { No3yBotsGrid } from "./No3yBotsGrid";
import { listNo3yBots } from "./forkBots";
import { No3yThreadsHeader } from "./No3yScreenHeader";
import { No3yStatusSectionHeader } from "./No3yStatusSectionHeader";
import { No3yPendingDraftRow, No3yThreadRow } from "./No3yThreadRow";
import { No3yThreadsFilterBar } from "./No3yThreadsFilterBar";
import { useNo3yStatusGroupedList } from "./useNo3yStatusGroupedList";

const ESTIMATED_NO3Y_ROW_HEIGHT = 60;
const NO3Y_DRAW_DISTANCE = 1_000;

function FlatGlassScrollView(props: ScrollViewProps) {
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  return (
    <NativeScrollViewMarker
      style={{ flex: 1 }}
      scrollEdgeEffects={{
        ...nativeHeaderScrollEdgeEffects(Platform.OS, Platform.Version),
        top: Number.parseInt(String(Platform.Version), 10) >= 27 ? "automatic" : "soft",
      }}
    >
      <ScrollView {...props} style={[props.style, { backgroundColor: palette.stageBackground }]} />
    </NativeScrollViewMarker>
  );
}

function renderFlatGlassScrollView(props: ScrollViewProps) {
  return <FlatGlassScrollView {...props} />;
}

export function No3yThreadsListView(props: {
  readonly visible: boolean;
  readonly sidebarSurface: boolean;
  readonly selectedThreadKey: string | null;
  readonly fullSwipeWidth: number | undefined;
  readonly contentSideInsets:
    | { readonly left: number; readonly right: number; readonly bottom: number }
    | undefined;
  readonly threads: ReadonlyArray<EnvironmentThreadShell>;
  readonly projects: ReadonlyArray<EnvironmentProject>;
  readonly projectScopes: ReadonlyArray<HomeProjectScope>;
  readonly scopedProjectGroup: HomeProjectScope | null;
  readonly projectByKey: ReadonlyMap<string, EnvironmentProject>;
  readonly projectTitleByProjectKey: ReadonlyMap<string, string>;
  readonly pendingTasks: ReadonlyArray<PendingNewTask>;
  readonly savedConnectionsById: Readonly<Record<string, SavedRemoteConnection>>;
  readonly environments: ReadonlyArray<
    HomeListFilterMenuEnvironment & Pick<WorkspaceEnvironment, "connectionState">
  >;
  readonly searchQuery: string;
  readonly searchIsPending: boolean;
  readonly searchMatchByKey: ReadonlyMap<string, EnvironmentThreadSearchMatch>;
  readonly searchMatchedQuery: string;
  readonly selectedEnvironmentId: EnvironmentId | null;
  readonly selectedProjectKey: string | null;
  readonly statusFilter: No3yStatusFilter;
  readonly sortOrder: No3yThreadSortOrder;
  readonly now: string;
  readonly queuedThreadKeys: ReadonlySet<string>;
  readonly providersByEnvironmentId: ReadonlyMap<EnvironmentId, ReadonlyArray<ThreadListProvider>>;
  readonly machineByEnvironmentId: ReadonlyMap<
    EnvironmentId,
    import("@t3tools/contracts").EnvironmentMachineKind
  >;
  readonly settlementEnvironmentIds: ReadonlySet<EnvironmentId>;
  readonly snoozeEnvironmentIds: ReadonlySet<EnvironmentId>;
  readonly snoozePresetsByEnvironmentId: ReadonlyMap<
    EnvironmentId,
    ReadonlyArray<SnoozePresetSetting>
  >;
  readonly pinningEnvironmentIds: ReadonlySet<EnvironmentId>;
  readonly autoSettleOptOutEnvironmentIds: ReadonlySet<EnvironmentId>;
  readonly pinReorderEnvironmentIds: ReadonlySet<EnvironmentId>;
  readonly activeReorderEnvironmentIds: ReadonlySet<EnvironmentId>;
  readonly titleRegenerationEnvironmentIds: ReadonlySet<EnvironmentId>;
  readonly onSearchQueryChange: (query: string) => void;
  readonly onEnvironmentChange: (environmentId: EnvironmentId | null) => void;
  readonly onProjectChange: (projectKey: string | null) => void;
  readonly onStatusFilterChange: (filter: No3yStatusFilter) => void;
  readonly onSortOrderChange: (order: No3yThreadSortOrder) => void;
  readonly onSelectThread: (thread: EnvironmentThreadShell) => void;
  readonly onArchiveThread: (thread: EnvironmentThreadShell) => void;
  readonly onDeleteThread: (thread: EnvironmentThreadShell) => void;
  readonly onSettleThread: (thread: EnvironmentThreadShell) => Promise<boolean>;
  readonly onSnoozeThread: (
    thread: EnvironmentThreadShell,
    snoozedUntil: string,
  ) => Promise<boolean>;
  readonly onUnsnoozeThread: (thread: EnvironmentThreadShell) => Promise<boolean>;
  readonly onUnsettleThread: (thread: EnvironmentThreadShell) => void;
  readonly onPinThread: (thread: EnvironmentThreadShell) => Promise<boolean>;
  readonly onUnpinThread: (thread: EnvironmentThreadShell) => Promise<boolean>;
  readonly onSetThreadAutoSettle: (
    thread: EnvironmentThreadShell,
    enabled: boolean,
  ) => Promise<boolean>;
  readonly onMoveThread: (
    thread: EnvironmentThreadShell,
    direction: ThreadMoveDestination,
  ) => Promise<boolean>;
  readonly onRenameThread: (thread: EnvironmentThreadShell) => void;
  readonly onRegenerateThreadTitle: (thread: EnvironmentThreadShell) => Promise<boolean>;
  readonly onSelectPendingTask: (pendingTask: PendingNewTask) => void;
  readonly onDeletePendingTask: (pendingTask: PendingNewTask) => void;
  readonly onNewThreadOnBranch: (thread: EnvironmentThreadShell) => void;
}) {
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const workspace = useWorkspaceTabs();
  const no3yBottomNav = useNo3yBottomNavEnabled();
  const insets = useSafeAreaInsets();
  const barTopInset = useContentTopInset();
  // The no3y Threads header lays out above the list instead of over it.
  const contentTopInset = no3yBottomNav ? 0 : barTopInset;
  const trayContentInset = useNo3yTrayContentInset();
  const activeNewTask = useActiveNewTask();
  const pendingOrder = usePendingThreadOrder();
  const resolveProviderInstance = useThreadRowProviderInstanceResolver(
    props.providersByEnvironmentId,
  );
  const openThreadPullRequests = useOpenThreadPullRequests();
  const onFabScroll = useFabScroll();
  const homeScrollGesture = useNativeGesture();
  const openSwipeableRef = useRef<SwipeableMethods | null>(null);
  const listRef = useRef<LegendListRef>(null);
  const [initialScrollOffset] = useState(() => workspace?.getScrollOffset("threads") ?? 0);

  const [settledVisibleCount, setSettledVisibleCount] = useState(
    THREAD_LIST_V2_SETTLED_INITIAL_COUNT,
  );
  const settledResetKey = `${props.selectedEnvironmentId ?? "all"}:${props.selectedProjectKey ?? "all"}:${props.statusFilter}:${props.searchQuery.trim()}`;
  const [lastSettledResetKey, setLastSettledResetKey] = useState(settledResetKey);
  if (lastSettledResetKey !== settledResetKey) {
    setLastSettledResetKey(settledResetKey);
    setSettledVisibleCount(THREAD_LIST_V2_SETTLED_INITIAL_COUNT);
  }
  const showMoreSettled = () =>
    setSettledVisibleCount((count) => count + THREAD_LIST_V2_SETTLED_PAGE_COUNT);

  const {
    loaded: shelfPreferencesLoaded,
    settledShelfExpanded,
    snoozedShelfExpanded,
    toggleSettledShelf,
    toggleSnoozedShelf,
  } = useThreadListV2ShelfPreferences();

  const { items, hiddenSettledCount, contentOnlyThreadKeys, olderSettledShelf, toggleSection } =
    useNo3yStatusGroupedList({
      threads: props.threads,
      pendingTasks: props.pendingTasks,
      environmentId: props.selectedEnvironmentId,
      projectRefs: props.scopedProjectGroup === null ? null : props.scopedProjectGroup.projectRefs,
      searchQuery: props.searchQuery,
      searchMatches: props.searchMatchByKey,
      statusFilter: props.statusFilter,
      sortOrder: props.sortOrder,
      settlementEnvironmentIds: props.settlementEnvironmentIds,
      snoozeEnvironmentIds: props.snoozeEnvironmentIds,
      pinReorderEnvironmentIds: props.pinReorderEnvironmentIds,
      activeReorderEnvironmentIds: props.activeReorderEnvironmentIds,
      queuedThreadKeys: props.queuedThreadKeys,
      settledLimit: settledVisibleCount,
      now: props.now,
      pendingOrder,
      shelfPreferencesLoaded,
      snoozedShelfExpanded,
      settledShelfExpanded,
      toggleSnoozedShelf,
      toggleSettledShelf,
      selectedThreadKey: props.selectedThreadKey,
    });

  const handleSwipeableWillOpen = (methods: SwipeableMethods) => {
    if (openSwipeableRef.current !== methods) {
      openSwipeableRef.current?.close();
      openSwipeableRef.current = methods;
    }
  };
  const handleSwipeableClose = (methods: SwipeableMethods) => {
    if (openSwipeableRef.current === methods) openSwipeableRef.current = null;
  };
  const handleScrollBeginDrag = () => {
    openSwipeableRef.current?.close();
  };
  const handleOpenThreadPullRequests = (
    thread: EnvironmentThreadShell,
    pr: ThreadPrPresentation,
  ) => {
    openSwipeableRef.current?.close();
    openThreadPullRequests(thread, pr);
  };

  const swipeRowActivation = createSwipeRowActivation();
  const activateVisibleRows = (rows: ReadonlyArray<No3yStatusGroupedListItem>) => {
    const state = listRef.current?.getState();
    if (state === undefined || !(state.end >= 0)) return;
    swipeRowActivation.activate(
      rows.slice(Math.max(0, state.start - 2), state.end + 3).map((row) => row.key),
    );
  };
  const activationTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(activationTimerRef.current), []);

  const handleListScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    onFabScroll?.(event);
    if (workspace) {
      workspace.recordScrollOffset(
        "threads",
        Math.max(0, event.nativeEvent.contentOffset.y + contentTopInset),
      );
    }
    clearTimeout(activationTimerRef.current);
    activationTimerRef.current = setTimeout(
      () => activateVisibleRows(listRef.current?.getState().data ?? []),
      200,
    );
  };

  const trackListTouches = (event: GestureResponderEvent, started: boolean) => {
    const { changedTouches, touches } = event.nativeEvent;
    swipeRowActivation.trackTouches(
      started ? changedTouches.map((touch) => String(touch.identifier)) : [],
      touches.map((touch) => String(touch.identifier)),
    );
  };

  const { swipeEnabled, scrollGateHandlers } = useSwipeableScrollGate({
    onScroll: handleListScroll,
    onScrollBeginDrag: handleScrollBeginDrag,
  });

  const searchMode = workspace?.state.tabs.threads.searchMode;
  const restoredOffset = workspace?.state.tabs.threads.scrollOffset;
  useSearchScrollRestoration(searchMode, () => {
    if (restoredOffset === undefined) return;
    void listRef.current?.scrollToOffset({
      offset: restoredOffset - contentTopInset,
      animated: false,
    });
  });

  useEffect(() => {
    if (swipeEnabled) activateVisibleRows(items);
  }, [activateVisibleRows, swipeEnabled, items]);

  const hasRowsToLayOut = props.visible && items.length > 0;
  useLayoutEffect(() => {
    return hasRowsToLayOut ? holdLaunchSplashForHomeRows() : undefined;
  }, [hasRowsToLayOut]);

  const { onSelectThread } = props;
  const selectThread = (thread: EnvironmentThreadShell) => {
    const key = threadSearchMatchKey({ environmentId: thread.environmentId, threadId: thread.id });
    const messageId = contentOnlyThreadKeys.has(key)
      ? props.searchMatchByKey.get(key)?.messageId
      : undefined;
    if (messageId) {
      requestThreadMessageJump(scopedThreadKey(thread.environmentId, thread.id), messageId);
    }
    onSelectThread(thread);
  };

  const renderItem = ({ item }: { readonly item: No3yStatusGroupedListItem }) => {
    if (item.type === "no3y-section-header") {
      return (
        <No3yStatusSectionHeader
          section={item.section}
          count={item.count}
          isFirst={item.isFirst}
          collapsed={item.collapsed}
          disabled={item.disabled}
          onToggle={toggleSection}
        />
      );
    }
    if (item.type === "no3y-pending") {
      const pendingScopeKey = scopedProjectKey(
        item.pendingTask.environmentId,
        item.pendingTask.projectId,
      );
      return (
        <No3yPendingDraftRow
          pendingTask={item.pendingTask}
          selected={
            activeNewTask?.pendingKey === item.pendingTask.key ||
            (item.pendingTask.kind === "pending" &&
              scopedThreadKey(item.pendingTask.environmentId, item.pendingTask.message.threadId) ===
                props.selectedThreadKey)
          }
          project={props.projectByKey.get(pendingScopeKey) ?? null}
          projectTitle={props.projectTitleByProjectKey.get(pendingScopeKey)}
          environmentLabel={
            Object.keys(props.savedConnectionsById).length > 1
              ? (props.savedConnectionsById[item.pendingTask.environmentId]?.environmentLabel ??
                null)
              : null
          }
          onSelectPendingTask={props.onSelectPendingTask}
          onDeletePendingTask={props.onDeletePendingTask}
        />
      );
    }
    const thread = item.item.thread;
    const searchKey = threadSearchMatchKey({
      environmentId: thread.environmentId,
      threadId: thread.id,
    });
    return (
      <No3yThreadRow
        thread={thread}
        variant={item.item.variant}
        statusKind={item.statusKind}
        statusSection={item.statusSection}
        selected={scopedThreadKey(thread.environmentId, thread.id) === props.selectedThreadKey}
        snoozed={item.item.snoozed}
        pinned={item.item.pinned}
        wokeAt={item.item.wokeAt}
        hasQueuedMessages={item.hasQueuedMessages}
        snoozePresetMinute={item.snoozePresetMinute ?? ""}
        snoozeWakeLabelText={item.snoozeWakeLabelText}
        timeLabel={item.timeLabel}
        project={
          props.projectByKey.get(scopedProjectKey(thread.environmentId, thread.projectId)) ?? null
        }
        providerInstance={resolveProviderInstance(thread)}
        providers={props.providersByEnvironmentId.get(thread.environmentId)}
        environmentLabel={
          Object.keys(props.savedConnectionsById).length > 1
            ? (props.savedConnectionsById[thread.environmentId]?.environmentLabel ?? null)
            : null
        }
        environmentMachine={props.machineByEnvironmentId.get(thread.environmentId)}
        searchMatch={
          contentOnlyThreadKeys.has(searchKey) ? props.searchMatchByKey.get(searchKey) : undefined
        }
        searchQuery={props.searchMatchedQuery}
        fullSwipeWidth={props.fullSwipeWidth}
        settlementSupported={props.settlementEnvironmentIds.has(thread.environmentId)}
        snoozeSupported={props.snoozeEnvironmentIds.has(thread.environmentId)}
        snoozePresets={props.snoozePresetsByEnvironmentId.get(thread.environmentId)}
        pinningSupported={props.pinningEnvironmentIds.has(thread.environmentId)}
        autoSettleOptOutSupported={props.autoSettleOptOutEnvironmentIds.has(thread.environmentId)}
        titleRegenerationSupported={props.titleRegenerationEnvironmentIds.has(thread.environmentId)}
        reorderSupported={
          item.item.pinned ? props.pinReorderEnvironmentIds.has(thread.environmentId) : false
        }
        canMoveUp={item.canMoveUp}
        canMoveDown={item.canMoveDown}
        activationKey={item.key}
        simultaneousSwipeGesture={homeScrollGesture}
        onSelectThread={selectThread}
        onOpenThreadPullRequests={handleOpenThreadPullRequests}
        onDeleteThread={props.onDeleteThread}
        onArchiveThread={props.onArchiveThread}
        onRenameThread={props.onRenameThread}
        onRegenerateThreadTitle={props.onRegenerateThreadTitle}
        onNewThreadOnBranch={props.onNewThreadOnBranch}
        onSettleThread={props.onSettleThread}
        onSnoozeThread={props.onSnoozeThread}
        onUnsnoozeThread={props.onUnsnoozeThread}
        onUnsettleThread={props.onUnsettleThread}
        onPinThread={props.onPinThread}
        onUnpinThread={props.onUnpinThread}
        onSetThreadAutoSettle={props.onSetThreadAutoSettle}
        onMoveThread={props.onMoveThread}
        onSwipeableWillOpen={handleSwipeableWillOpen}
        onSwipeableClose={handleSwipeableClose}
      />
    );
  };

  const hasSearchQuery = props.searchQuery.trim().length > 0;
  // Bots sit above the sections; search and the environment filter narrow them too.
  const botQuery = props.searchQuery.trim().toLocaleLowerCase();
  const bots = listNo3yBots(props.threads).filter(
    (bot) =>
      (props.selectedEnvironmentId === null || bot.environmentId === props.selectedEnvironmentId) &&
      (botQuery.length === 0 ||
        bot.title.toLocaleLowerCase().includes(botQuery) ||
        props.searchMatchByKey.has(
          threadSearchMatchKey({ environmentId: bot.environmentId, threadId: bot.id }),
        )),
  );
  const listEmpty =
    hasSearchQuery && props.searchIsPending ? (
      <EmptyState
        title="Searching thread messages…"
        detail={`Looking for "${props.searchQuery}" in messages.`}
      />
    ) : hasSearchQuery ? (
      <EmptyState title="No results" detail={`No threads matching "${props.searchQuery}".`} />
    ) : props.statusFilter !== "all" ? (
      <EmptyState
        title="No matching threads"
        detail="Try clearing the status filter to view all threads."
      />
    ) : props.scopedProjectGroup !== null ? (
      <EmptyState
        title={`No threads in ${props.scopedProjectGroup.title}`}
        detail="Choose another project or create a new task."
      />
    ) : (
      <EmptyState title="No threads yet" detail="Tap + below to start a new agent session." />
    );

  const bottomPadding = no3yBottomNav
    ? trayContentInset
    : Math.max(
        (props.contentSideInsets?.bottom ?? insets.bottom) + 24,
        workspace?.bottomClearance ?? 0,
      );

  const filterBar = (
    <No3yThreadsFilterBar
      palette={palette}
      environments={props.environments}
      projects={pickableProjectGroups(props.projectScopes).map((scope) => ({
        key: scope.key,
        label: scope.title,
      }))}
      selectedEnvironmentId={props.selectedEnvironmentId}
      selectedProjectKey={props.selectedProjectKey}
      onEnvironmentChange={props.onEnvironmentChange}
      onProjectChange={props.onProjectChange}
      searchQuery={props.searchQuery}
      onSearchQueryChange={props.onSearchQueryChange}
      statusFilter={props.statusFilter}
      onStatusFilterChange={props.onStatusFilterChange}
      sortOrder={props.sortOrder}
      onSortOrderChange={props.onSortOrderChange}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: palette.stageBackground }}>
      {no3yBottomNav ? <No3yThreadsHeader /> : null}
      <ScreenContent surface="screen">
        <View style={{ flex: 1, backgroundColor: palette.stageBackground }}>
          <SwipeableScrollGateProvider enabled={swipeEnabled} activation={swipeRowActivation}>
            <GestureDetector gesture={homeScrollGesture}>
              <AnimatedLegendList
                // Rows slide into the room a folded section or a settled card leaves.
                itemLayoutAnimation={
                  props.sidebarSurface || no3yBottomNav ? THREAD_LIST_ROW_LAYOUT : undefined
                }
                ref={listRef}
                onLoad={() => {
                  settleLaunchSplashHomeRows();
                  activateVisibleRows(items);
                }}
                onTouchStart={(event) => trackListTouches(event, true)}
                onTouchEnd={(event) => trackListTouches(event, false)}
                onTouchCancel={(event) => trackListTouches(event, false)}
                renderScrollComponent={renderFlatGlassScrollView}
                data={items}
                renderItem={renderItem}
                keyExtractor={(item) => item.key}
                getItemType={(item) => item.type}
                itemsAreEqual={no3yStatusGroupedItemsAreEqual}
                estimatedItemSize={ESTIMATED_NO3Y_ROW_HEIGHT}
                drawDistance={NO3Y_DRAW_DISTANCE}
                recycleItems
                extraData={{
                  activeNewTask,
                  projectByKey: props.projectByKey,
                  projectTitleByProjectKey: props.projectTitleByProjectKey,
                  savedConnectionsById: props.savedConnectionsById,
                  searchQuery: props.searchQuery,
                  selectedThreadKey: props.selectedThreadKey,
                  searchMatchByKey: props.searchMatchByKey,
                  themeAppearance,
                }}
                ListHeaderComponent={
                  no3yBottomNav ? (
                    <No3yBotsGrid
                      bots={bots}
                      threads={props.threads}
                      now={props.now}
                      onOpen={selectThread}
                      onRename={props.onRenameThread}
                      onArchive={props.onArchiveThread}
                      onDelete={props.onDeleteThread}
                    />
                  ) : (
                    <View style={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 }}>
                      {filterBar}
                    </View>
                  )
                }
                ListHeaderComponentStyle={{ zIndex: 1 }}
                ListFooterComponent={
                  settledShelfExpanded && hiddenSettledCount > 0 ? (
                    <ThreadListV2ShowMoreRow
                      hiddenCount={hiddenSettledCount}
                      {...(olderSettledShelf.loading
                        ? { state: "loading" as const }
                        : olderSettledShelf.failed
                          ? { state: "failed" as const }
                          : {})}
                      onPress={() => {
                        olderSettledShelf.retry();
                        showMoreSettled();
                      }}
                    />
                  ) : null
                }
                ListEmptyComponent={listEmpty}
                style={{ flex: 1 }}
                automaticallyAdjustsScrollIndicatorInsets
                contentInsetAdjustmentBehavior="never"
                contentInset={{ top: contentTopInset }}
                initialScrollOffset={
                  initialScrollOffset > 0 ? initialScrollOffset - contentTopInset : undefined
                }
                showsVerticalScrollIndicator={false}
                keyboardDismissMode="on-drag"
                keyboardShouldPersistTaps="handled"
                {...scrollGateHandlers}
                scrollEventThrottle={16}
                contentContainerStyle={{
                  paddingLeft: props.contentSideInsets?.left ?? 0,
                  paddingRight: props.contentSideInsets?.right ?? 0,
                  paddingBottom: bottomPadding,
                }}
              />
            </GestureDetector>
          </SwipeableScrollGateProvider>
        </View>
      </ScreenContent>
      {no3yBottomNav ? (
        <No3yBottomTray color={palette.stageBackground}>{filterBar}</No3yBottomTray>
      ) : null}
    </View>
  );
}
