/** Mobile status-grouped thread list, search/filter/sort pipeline, nav state, and peek selectors. */
import { isScratchProject } from "@t3tools/client-runtime/state/projects";
import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import {
  threadSearchMatchKey,
  threadSearchSubject,
} from "@t3tools/client-runtime/state/thread-search";
import {
  canSnooze,
  effectiveSnoozed,
  snoozeWakeLabel,
} from "@t3tools/client-runtime/state/thread-settled";
import {
  getThreadSortTimestamp,
  resolveSettledThreadTimestamp,
  resolveThreadActivityTimestamp,
  sortPinnedThreadsByOrderKey,
  sortSettledThreads,
} from "@t3tools/client-runtime/state/thread-sort";
import { isListedThreadLineage, type EnvironmentId, type ProjectId } from "@t3tools/contracts";
import { foldSearchQuery, rankSearchItems, scoreThreadSearch } from "@t3tools/shared/paletteSearch";

import { filterForkRosterVisibleThreads } from "./forkRosterVisibility";
import {
  groupSidebarV2StatusSections,
  partitionForkStatusShelves,
  resolveSidebarV2CardStatusKind,
  sidebarV2StatusBucketForKind,
  type SidebarV2CardStatusKind,
  type SidebarV2CompletedHoldTracker,
  type SidebarV2StatusBucket,
  type SidebarV2StatusHeaderKey,
  type SidebarV2StatusSectionKey,
} from "./forkStatusGrouping";

import { relativeTime } from "../src/lib/time";
import type { PendingNewTask } from "../src/state/use-pending-new-tasks";
import type { ThreadMoveAvailability } from "../src/features/threads/threadOrder";
import {
  resolveThreadListV2Status,
  resolveThreadListV2WokeAt,
  threadHasUnseenCompletion,
  type ThreadListV2Item,
} from "../src/features/threads/threadListV2";

export type No3yStatusFilter = "all" | SidebarV2StatusBucket;
export type No3yThreadSortOrder = "status" | "updated_at" | "created_at";
export type No3yNavItemId = "threads" | "automations" | "newAgent" | "chat" | "settings";

export const NO3Y_CHAT_THREAD_TAG = "chat";

export const NO3Y_STATUS_FILTER_OPTIONS: ReadonlyArray<{
  readonly id: No3yStatusFilter;
  readonly label: string;
}> = [
  { id: "all", label: "All statuses" },
  { id: "input", label: "Needs input" },
  { id: "done", label: "Completed" },
  { id: "working", label: "Working" },
  { id: "idle", label: "Idle" },
  { id: "drafts", label: "Drafts" },
];

export const NO3Y_THREAD_SORT_OPTIONS: ReadonlyArray<{
  readonly id: No3yThreadSortOrder;
  readonly label: string;
}> = [
  { id: "status", label: "Default (Mac order)" },
  { id: "updated_at", label: "Recently updated" },
  { id: "created_at", label: "Newest created" },
];

export function isNo3yChatThread(
  thread: Pick<EnvironmentThreadShell, "environmentId" | "projectId" | "source">,
  scratchProjectKeys?: ReadonlySet<string>,
): boolean {
  if (thread.source.tags?.includes(NO3Y_CHAT_THREAD_TAG) === true) return true;
  return scratchProjectKeys?.has(`${thread.environmentId}:${thread.projectId}`) === true;
}

export function buildScratchProjectKeySet(
  projects: ReadonlyArray<EnvironmentProject>,
  scratchWorkspaceRootByEnvironmentId: ReadonlyMap<EnvironmentId, string | null | undefined>,
): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const project of projects) {
    const scratchRoot = scratchWorkspaceRootByEnvironmentId.get(project.environmentId);
    if (isScratchProject(project, scratchRoot)) {
      keys.add(`${project.environmentId}:${project.id}`);
    }
  }
  return keys;
}

export function resolveNo3yThreadCardStatusKind(
  thread: EnvironmentThreadShell,
  options: { readonly now: string; readonly wokeAt?: string | null },
): SidebarV2CardStatusKind | null {
  const status = resolveThreadListV2Status(thread);
  const isUnread = status === "ready" && threadHasUnseenCompletion(thread);
  const wokeAt =
    options.wokeAt !== undefined
      ? options.wokeAt
      : resolveThreadListV2WokeAt(thread, { now: options.now });
  return resolveSidebarV2CardStatusKind({
    status,
    isUnread,
    isWoke: wokeAt !== null,
    hasPendingBackgroundTasks: thread.pendingBackgroundTasks.length > 0,
  });
}

export interface No3yStatusSectionHeaderItem {
  readonly type: "no3y-section-header";
  readonly key: string;
  readonly section: SidebarV2StatusHeaderKey;
  readonly count: number;
  readonly collapsed: boolean;
  readonly isFirst: boolean;
  readonly disabled: boolean;
}

export interface No3yPendingListItem {
  readonly type: "no3y-pending";
  readonly key: string;
  readonly pendingTask: PendingNewTask;
}

export interface No3yThreadListItem {
  readonly type: "no3y-thread";
  readonly key: string;
  readonly item: ThreadListV2Item;
  readonly statusKind: SidebarV2CardStatusKind | null;
  readonly statusSection: SidebarV2StatusBucket | undefined;
  readonly snoozeWakeLabelText: string | undefined;
  readonly timeLabel: string;
  readonly snoozePresetMinute: string | undefined;
  readonly hasQueuedMessages: boolean;
  readonly canMoveUp: boolean;
  readonly canMoveDown: boolean;
}

export type No3yStatusGroupedListItem =
  | No3yStatusSectionHeaderItem
  | No3yPendingListItem
  | No3yThreadListItem;

export interface No3yStatusGroupedListResult {
  readonly items: ReadonlyArray<No3yStatusGroupedListItem>;
  readonly listedSettledThreads: ReadonlyArray<EnvironmentThreadShell>;
  readonly hiddenSettledCount: number;
  readonly settledCount: number;
  readonly contentOnlyThreadKeys: ReadonlySet<string>;
}

function parseTimestampMs(isoDate: string): number {
  const parsed = Date.parse(isoDate);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortThreadsByTimestamp(
  threads: readonly EnvironmentThreadShell[],
  sortOrder: Exclude<No3yThreadSortOrder, "status">,
): EnvironmentThreadShell[] {
  return [...threads].sort((left, right) => {
    const delta =
      getThreadSortTimestamp(right, sortOrder) - getThreadSortTimestamp(left, sortOrder);
    if (delta !== 0) return delta;
    return left.id.localeCompare(right.id);
  });
}

function resolveRowTimeLabel(
  item: ThreadListV2Item,
  statusKind: SidebarV2CardStatusKind | null,
  hasSnoozeWakeLabel: boolean,
): string {
  if (hasSnoozeWakeLabel) return "";
  if (item.variant === "card" && statusKind === "working") return "";
  const settledTimestamp =
    item.variant === "slim" && !item.snoozed ? resolveSettledThreadTimestamp(item.thread) : null;
  return relativeTime(
    settledTimestamp ?? resolveThreadActivityTimestamp(item.thread) ?? item.thread.createdAt,
  );
}

export function no3yStatusGroupedItemsAreEqual(
  previous: No3yStatusGroupedListItem,
  next: No3yStatusGroupedListItem,
): boolean {
  if (previous.type !== next.type || previous.key !== next.key) return false;
  switch (next.type) {
    case "no3y-section-header":
      return (
        previous.type === "no3y-section-header" &&
        previous.section === next.section &&
        previous.count === next.count &&
        previous.collapsed === next.collapsed &&
        previous.isFirst === next.isFirst &&
        previous.disabled === next.disabled
      );
    case "no3y-pending":
      return previous.type === "no3y-pending" && previous.pendingTask === next.pendingTask;
    case "no3y-thread":
      return (
        previous.type === "no3y-thread" &&
        previous.item.thread === next.item.thread &&
        previous.item.variant === next.item.variant &&
        previous.item.snoozed === next.item.snoozed &&
        previous.item.pinned === next.item.pinned &&
        previous.item.wokeAt === next.item.wokeAt &&
        previous.statusKind === next.statusKind &&
        previous.statusSection === next.statusSection &&
        previous.snoozeWakeLabelText === next.snoozeWakeLabelText &&
        previous.timeLabel === next.timeLabel &&
        previous.snoozePresetMinute === next.snoozePresetMinute &&
        previous.hasQueuedMessages === next.hasQueuedMessages &&
        previous.canMoveUp === next.canMoveUp &&
        previous.canMoveDown === next.canMoveDown
      );
  }
}

export function buildNo3yStatusGroupedList(input: {
  readonly threads: ReadonlyArray<EnvironmentThreadShell>;
  readonly pendingTasks: ReadonlyArray<PendingNewTask>;
  readonly environmentId: EnvironmentId | null;
  readonly projectRefs: ReadonlyArray<{
    readonly environmentId: EnvironmentId;
    readonly projectId: ProjectId;
  }> | null;
  readonly searchQuery: string;
  readonly matchedThreadKeys?: ReadonlySet<string>;
  readonly statusFilter: No3yStatusFilter;
  readonly sortOrder: No3yThreadSortOrder;
  readonly collapsedSections: ReadonlySet<SidebarV2StatusSectionKey>;
  readonly snoozedShelfExpanded: boolean;
  readonly settledShelfExpanded: boolean;
  readonly shelfPreferencesLoading?: boolean;
  readonly settledLimit: number;
  readonly now: string;
  readonly nowMs?: number;
  readonly snoozeLabelNow?: string;
  readonly openThreadKey: string | null;
  readonly holds: SidebarV2CompletedHoldTracker;
  readonly returnedAt?: ((thread: EnvironmentThreadShell) => number | undefined) | undefined;
  readonly settlementEnvironmentIds?: ReadonlySet<EnvironmentId>;
  readonly snoozeEnvironmentIds?: ReadonlySet<EnvironmentId>;
  readonly queuedThreadKeys?: ReadonlySet<string>;
  readonly moveAvailability?: ReadonlyMap<string, ThreadMoveAvailability>;
  readonly isListedSettled?: (thread: EnvironmentThreadShell) => boolean;
  readonly unloadedSettledCount?: number;
  /** Exclude chat-tagged threads from the Threads (code) list when true. */
  readonly excludeChatThreads?: boolean;
  readonly scratchProjectKeys?: ReadonlySet<string>;
}): No3yStatusGroupedListResult {
  const now = input.now;
  const nowMs = input.nowMs ?? Date.parse(now);
  const query = foldSearchQuery(input.searchQuery);
  const projectKeys = input.projectRefs
    ? new Set(input.projectRefs.map((ref) => `${ref.environmentId}:${ref.projectId}`))
    : null;
  const queuedThreadKeys = input.queuedThreadKeys?.size ? input.queuedThreadKeys : undefined;

  const rosterThreads = filterForkRosterVisibleThreads(input.threads);
  const listedThreads = rosterThreads.filter((thread) => {
    if (input.environmentId !== null && thread.environmentId !== input.environmentId) return false;
    if (projectKeys !== null && !projectKeys.has(`${thread.environmentId}:${thread.projectId}`)) {
      return false;
    }
    if (input.excludeChatThreads === true && isNo3yChatThread(thread, input.scratchProjectKeys)) {
      return false;
    }
    return true;
  });

  const scopedPendingTasks = input.pendingTasks.filter((pendingTask) => {
    if (input.environmentId !== null && pendingTask.environmentId !== input.environmentId) {
      return false;
    }
    if (
      projectKeys !== null &&
      !projectKeys.has(`${pendingTask.environmentId}:${pendingTask.projectId}`)
    ) {
      return false;
    }
    if (query.length > 0 && !pendingTask.title.toLocaleLowerCase().includes(query)) return false;
    return true;
  });

  const makeThreadListItem = (
    thread: EnvironmentThreadShell,
    options: {
      readonly variant: "card" | "slim";
      readonly snoozed: boolean;
      readonly pinned: boolean;
      readonly statusKind: SidebarV2CardStatusKind | null;
      readonly statusSection: SidebarV2StatusBucket | undefined;
    },
  ): No3yThreadListItem => {
    const wokeAt = options.variant === "slim" ? null : resolveThreadListV2WokeAt(thread, { now });
    const item: ThreadListV2Item = {
      thread,
      variant: options.variant,
      snoozed: options.snoozed,
      pinned: options.pinned,
      wokeAt,
      isLast: false,
    };
    const snoozeWakeLabelText =
      options.snoozed && thread.snoozedUntil != null && input.snoozeLabelNow !== undefined
        ? snoozeWakeLabel(thread.snoozedUntil, { now: input.snoozeLabelNow })
        : undefined;
    const snoozePresetMinute =
      !options.snoozed &&
      input.snoozeLabelNow !== undefined &&
      (input.snoozeEnvironmentIds?.has(thread.environmentId) ?? true) &&
      canSnooze(thread, { now: input.snoozeLabelNow })
        ? input.snoozeLabelNow
        : undefined;
    const move =
      options.variant === "card"
        ? input.moveAvailability?.get(`${thread.environmentId}:${thread.id}`)
        : undefined;
    return {
      type: "no3y-thread",
      key: `no3y-thread:${thread.environmentId}:${thread.id}`,
      item,
      statusKind: options.statusKind,
      statusSection: options.statusSection,
      snoozeWakeLabelText,
      timeLabel: resolveRowTimeLabel(item, options.statusKind, snoozeWakeLabelText !== undefined),
      snoozePresetMinute,
      hasQueuedMessages: queuedThreadKeys?.has(`${thread.environmentId}:${thread.id}`) === true,
      canMoveUp: move?.canMoveUp === true,
      canMoveDown: move?.canMoveDown === true,
    };
  };

  // Search mode: ranked flat matches across shelves, matching Mac & upstream mobile.
  const contentOnlyThreadKeys = new Set<string>();
  if (query.length > 0) {
    const rankedMatches = rankSearchItems(listedThreads, (thread, options) =>
      scoreThreadSearch(query, threadSearchSubject(thread, null), nowMs, {
        ...options,
        picks: false,
      }),
    ).map(({ item }) => item);
    const matchingSet = new Set(rankedMatches);
    const threadByKey = new Map(
      listedThreads.map((thread) => [
        threadSearchMatchKey({ environmentId: thread.environmentId, threadId: thread.id }),
        thread,
      ]),
    );
    const contentOnly: EnvironmentThreadShell[] = [];
    for (const key of input.matchedThreadKeys ?? []) {
      const thread = threadByKey.get(key);
      if (thread && !matchingSet.has(thread)) {
        contentOnlyThreadKeys.add(key);
        contentOnly.push(thread);
      }
    }
    const results: No3yStatusGroupedListItem[] = [];
    if (input.statusFilter === "all" || input.statusFilter === "drafts") {
      for (const pendingTask of scopedPendingTasks) {
        results.push({ type: "no3y-pending", key: `no3y-${pendingTask.key}`, pendingTask });
      }
    }
    for (const thread of [...rankedMatches, ...contentOnly]) {
      const supportsSettlement = input.settlementEnvironmentIds?.has(thread.environmentId) ?? true;
      const supportsSnooze = input.snoozeEnvironmentIds?.has(thread.environmentId) ?? true;
      const snoozed = supportsSnooze && effectiveSnoozed(thread, { now });
      const hasQueued = queuedThreadKeys?.has(`${thread.environmentId}:${thread.id}`) === true;
      const settled = supportsSettlement && thread.settledOverride === "settled" && !hasQueued;
      const statusKind = resolveNo3yThreadCardStatusKind(thread, { now });
      const bucket = sidebarV2StatusBucketForKind(statusKind);
      if (input.statusFilter !== "all" && input.statusFilter !== bucket) continue;
      results.push(
        makeThreadListItem(thread, {
          variant: snoozed || settled ? "slim" : "card",
          snoozed,
          pinned: !snoozed && !settled && thread.pinnedAt != null,
          statusKind,
          statusSection: snoozed || settled ? undefined : bucket,
        }),
      );
    }
    return {
      items: results,
      listedSettledThreads: [],
      hiddenSettledCount: 0,
      settledCount: 0,
      contentOnlyThreadKeys,
    };
  }

  // Partition into pinned, active, snoozed, settled.
  const { pinned, active, snoozed, settled } = partitionForkStatusShelves({
    threads: listedThreads,
    now,
    settlementEnvironmentIds: input.settlementEnvironmentIds,
    snoozeEnvironmentIds: input.snoozeEnvironmentIds,
    queuedThreadKeys,
  });

  // Derive card status kind & apply the Completed 5-minute hold tracker.
  const statusKindByKey = new Map<string, SidebarV2CardStatusKind | null>();
  const rawBuckets = new Map<string, SidebarV2StatusBucket>();
  for (const thread of active) {
    const key = `${thread.environmentId}:${thread.id}`;
    const kind = resolveNo3yThreadCardStatusKind(thread, { now });
    statusKindByKey.set(key, kind);
    rawBuckets.set(key, sidebarV2StatusBucketForKind(kind));
  }
  const effectiveBuckets = input.holds.apply({
    buckets: rawBuckets,
    openThreadKey: input.openThreadKey,
    nowMs: Number.isFinite(nowMs) ? nowMs : Date.now(),
  });

  const statusSections = groupSidebarV2StatusSections({
    threads: active,
    bucketOf: (thread) => effectiveBuckets.get(`${thread.environmentId}:${thread.id}`) ?? "idle",
    returnedAt: input.returnedAt,
  });

  const items: No3yStatusGroupedListItem[] = [];
  const shelfDisabled = input.shelfPreferencesLoading === true;
  const pushHeader = (
    section: SidebarV2StatusHeaderKey,
    count: number,
    collapsed: boolean,
    disabled = false,
  ) => {
    items.push({
      type: "no3y-section-header",
      key: `no3y-section:${section}`,
      section,
      count,
      collapsed,
      isFirst: items.length === 0,
      disabled,
    });
  };

  // 1. Drafts (painted above Pinned, matching Mac sidebar).
  if (
    scopedPendingTasks.length > 0 &&
    (input.statusFilter === "all" || input.statusFilter === "drafts")
  ) {
    const collapsed = input.collapsedSections.has("drafts");
    pushHeader("drafts", scopedPendingTasks.length, collapsed);
    if (!collapsed) {
      for (const pendingTask of scopedPendingTasks) {
        items.push({ type: "no3y-pending", key: `no3y-${pendingTask.key}`, pendingTask });
      }
    }
  }

  // 2. Pinned (collapsible status header while status-grouped).
  const orderedPinned =
    input.sortOrder === "status"
      ? sortPinnedThreadsByOrderKey(pinned)
      : sortThreadsByTimestamp(pinned, input.sortOrder);
  const filteredPinned =
    input.statusFilter === "all"
      ? orderedPinned
      : orderedPinned.filter((thread) => {
          const kind = resolveNo3yThreadCardStatusKind(thread, { now });
          return sidebarV2StatusBucketForKind(kind) === input.statusFilter;
        });
  if (filteredPinned.length > 0) {
    const collapsed = input.collapsedSections.has("pinned");
    pushHeader("pinned", filteredPinned.length, collapsed);
    if (!collapsed) {
      for (const thread of filteredPinned) {
        const statusKind = resolveNo3yThreadCardStatusKind(thread, { now });
        items.push(
          makeThreadListItem(thread, {
            variant: "card",
            snoozed: false,
            pinned: true,
            statusKind,
            statusSection: sidebarV2StatusBucketForKind(statusKind),
          }),
        );
      }
    }
  }

  // 3. Status sections: Needs input -> Completed -> Working -> Idle.
  for (const section of statusSections) {
    if (input.statusFilter !== "all" && input.statusFilter !== section.status) continue;
    const collapsed = input.collapsedSections.has(section.status);
    pushHeader(section.status, section.threadCount, collapsed);
    if (!collapsed) {
      const sectionThreads =
        input.sortOrder === "status"
          ? section.threads
          : sortThreadsByTimestamp(section.threads, input.sortOrder);
      for (const thread of sectionThreads) {
        const key = `${thread.environmentId}:${thread.id}`;
        items.push(
          makeThreadListItem(thread, {
            variant: "card",
            snoozed: false,
            pinned: false,
            statusKind: statusKindByKey.get(key) ?? null,
            statusSection: section.status,
          }),
        );
      }
    }
  }

  // 4. Snoozed & Settled shelves (shown when not filtering to a single active status bucket).
  const showShelves = input.statusFilter === "all";
  const orderedSnoozed = [...snoozed].sort(
    (left, right) =>
      parseTimestampMs(left.snoozedUntil ?? "") - parseTimestampMs(right.snoozedUntil ?? ""),
  );
  if (showShelves && orderedSnoozed.length > 0) {
    pushHeader("snoozed", orderedSnoozed.length, !input.snoozedShelfExpanded, shelfDisabled);
    if (input.snoozedShelfExpanded) {
      for (const thread of orderedSnoozed) {
        items.push(
          makeThreadListItem(thread, {
            variant: "slim",
            snoozed: true,
            pinned: false,
            statusKind: null,
            statusSection: undefined,
          }),
        );
      }
    }
  }

  const orderedSettled =
    input.sortOrder === "status"
      ? sortSettledThreads(settled)
      : sortThreadsByTimestamp(settled, input.sortOrder);
  const listedSettled =
    input.isListedSettled === undefined
      ? orderedSettled
      : orderedSettled.filter(input.isListedSettled);
  const settledTotal = orderedSettled.length + (input.unloadedSettledCount ?? 0);
  const pagedSettled =
    listedSettled.length > input.settledLimit
      ? listedSettled.slice(0, input.settledLimit)
      : listedSettled;

  if (showShelves && settledTotal > 0) {
    pushHeader("settled", settledTotal, !input.settledShelfExpanded, shelfDisabled);
    if (input.settledShelfExpanded) {
      for (const thread of pagedSettled) {
        items.push(
          makeThreadListItem(thread, {
            variant: "slim",
            snoozed: false,
            pinned: false,
            statusKind: null,
            statusSection: undefined,
          }),
        );
      }
    }
  }

  return {
    items,
    listedSettledThreads: listedSettled,
    hiddenSettledCount: showShelves ? Math.max(0, settledTotal - pagedSettled.length) : 0,
    settledCount: settledTotal,
    contentOnlyThreadKeys,
  };
}

export interface No3yNavPeekEntry {
  readonly key: string;
  readonly thread: EnvironmentThreadShell;
  readonly statusKind: SidebarV2CardStatusKind | null;
}

/**
 * Unarchived threads launched by an automation (stamped with `scheduledTaskId`),
 * ordered newest activity first, for the Automations screen and its peek list.
 */
export function listNo3yAutomationRunThreads(input: {
  readonly threads: ReadonlyArray<EnvironmentThreadShell>;
  readonly environmentIds?: ReadonlySet<EnvironmentId> | null;
  readonly projectKeys?: ReadonlySet<string> | null;
}): ReadonlyArray<EnvironmentThreadShell> {
  return input.threads
    .filter((thread) => {
      if (thread.archivedAt !== null || !isListedThreadLineage(thread.lineage)) return false;
      if (thread.source.scheduledTaskId === undefined) return false;
      if (input.environmentIds != null && !input.environmentIds.has(thread.environmentId)) {
        return false;
      }
      if (
        input.projectKeys != null &&
        !input.projectKeys.has(`${thread.environmentId}:${thread.projectId}`)
      ) {
        return false;
      }
      return true;
    })
    .sort(
      (left, right) =>
        getThreadSortTimestamp(right, "updated_at") - getThreadSortTimestamp(left, "updated_at"),
    );
}

/** Dock items with a long-press peek; New agent and Settings have none. */
export function hasNo3yNavPeek(item: No3yNavItemId): boolean {
  return item === "threads" || item === "automations" || item === "chat";
}

/** Threads peek order: needs you, then running, then unseen completions, then the rest. */
function threadsPeekRank(statusKind: SidebarV2CardStatusKind | null): number {
  switch (sidebarV2StatusBucketForKind(statusKind)) {
    case "input":
      return 0;
    case "working":
      return 1;
    case "done":
      return 2;
    default:
      return 3;
  }
}

function peekEntry(thread: EnvironmentThreadShell, now: string): No3yNavPeekEntry {
  return {
    key: `${thread.environmentId}:${thread.id}`,
    thread,
    statusKind: resolveNo3yThreadCardStatusKind(thread, { now }),
  };
}

const byNewestActivity = (left: EnvironmentThreadShell, right: EnvironmentThreadShell) =>
  getThreadSortTimestamp(right, "updated_at") - getThreadSortTimestamp(left, "updated_at");

/** Pure selector for the long-press peek card above each dock item. */
export function selectNo3yNavPeekItems(input: {
  readonly item: No3yNavItemId;
  readonly threads: ReadonlyArray<EnvironmentThreadShell>;
  readonly scratchProjectKeys: ReadonlySet<string>;
  readonly now: string;
  readonly limit?: number;
}): ReadonlyArray<No3yNavPeekEntry> {
  const limit = input.limit ?? 5;

  if (input.item === "threads") {
    return filterForkRosterVisibleThreads(input.threads)
      .filter(
        (thread) =>
          !isNo3yChatThread(thread, input.scratchProjectKeys) &&
          thread.settledOverride !== "settled" &&
          !effectiveSnoozed(thread, { now: input.now }),
      )
      .map((thread) => peekEntry(thread, input.now))
      .sort(
        (left, right) =>
          threadsPeekRank(left.statusKind) - threadsPeekRank(right.statusKind) ||
          byNewestActivity(left.thread, right.thread),
      )
      .slice(0, limit);
  }

  if (input.item === "automations") {
    return listNo3yAutomationRunThreads({ threads: input.threads })
      .slice(0, limit)
      .map((thread) => peekEntry(thread, input.now));
  }

  if (input.item === "chat") {
    return listNo3yChatThreads({ ...input, searchQuery: "" })
      .slice(0, limit)
      .map((thread) => peekEntry(thread, input.now));
  }

  return [];
}

/** The Chat screen's list and its peek: the roster's chats, newest activity first, by title. */
export function listNo3yChatThreads(input: {
  readonly threads: ReadonlyArray<EnvironmentThreadShell>;
  readonly scratchProjectKeys: ReadonlySet<string>;
  readonly searchQuery: string;
}): ReadonlyArray<EnvironmentThreadShell> {
  const query = input.searchQuery.trim().toLocaleLowerCase();
  return filterForkRosterVisibleThreads(input.threads)
    .filter(
      (thread) =>
        isNo3yChatThread(thread, input.scratchProjectKeys) &&
        (query.length === 0 || thread.title.toLocaleLowerCase().includes(query)),
    )
    .sort(byNewestActivity);
}

interface RouteLike {
  readonly name: string;
  readonly params?: object | undefined;
}

const AUTOMATIONS_ROUTES = new Set([
  "SettingsScheduledTasks",
  "SettingsScheduledTaskNew",
  "SettingsScheduledTaskEdit",
  "SettingsScheduledTaskBranch",
  "SettingsScheduledTaskThread",
  "SettingsScheduledTaskModel",
]);

/** Settings routes presented as modals, which belong to no dock item. */
const SETTINGS_MODAL_ROUTES = new Set(["SettingsAuth", "SettingsWaitlist", "SettingsLegal"]);

const IMMERSIVE_OR_MODAL_ROUTES = new Set([
  "ThreadDevicePreview",
  "ThreadBrowserPreview",
  "ThreadMcpApp",
  "ThreadInspectorFullscreen",
  "SettingsAuth",
  "SettingsWaitlist",
  "SettingsLegal",
  "ConnectOnboarding",
  "Connections",
  "ConnectionsNew",
]);

function isDraftThreadRoute(route: RouteLike): boolean {
  return (
    route.name === "Thread" &&
    route.params !== undefined &&
    "draft" in route.params &&
    Boolean((route.params as { readonly draft?: unknown }).draft)
  );
}

/** Which dock item should read as active for the current stack; Settings has none. */
export function resolveActiveNo3yNavItem(routes: readonly RouteLike[]): No3yNavItemId | null {
  const top = routes.at(-1);
  if (!top) return "threads";
  if (top.name === "No3yChat") return "chat";
  if (AUTOMATIONS_ROUTES.has(top.name)) return "automations";
  // A run opened from Automations is pushed over it, and back returns there.
  const below = routes.at(-2);
  if (top.name === "Thread" && below !== undefined && AUTOMATIONS_ROUTES.has(below.name)) {
    return "automations";
  }
  if (top.name === "NewTaskProject" || top.name.startsWith("NewTask") || isDraftThreadRoute(top)) {
    return "newAgent";
  }
  if (top.name === "Home" || top.name === "Thread") return "threads";
  if (top.name.startsWith("Settings") && !SETTINGS_MODAL_ROUTES.has(top.name)) return "settings";
  return null;
}

/**
 * The dock shows on primary/workspace screens. It hides inside a thread (its composer takes the
 * bottom; New agent's draft thread keeps it) and when an overlay sheet, full-screen preview,
 * or auth modal covers the viewport.
 */
export function shouldShowNo3yBottomNav(input: {
  readonly topRoute: RouteLike | undefined;
  readonly isOverlayRoute: boolean;
}): boolean {
  if (input.isOverlayRoute) return false;
  const top = input.topRoute;
  if (top === undefined) return true;
  if (IMMERSIVE_OR_MODAL_ROUTES.has(top.name)) return false;
  return top.name !== "Thread" || isDraftThreadRoute(top);
}
