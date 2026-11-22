/**
 * React hook wrapping `buildNo3yStatusGroupedList` with the module-scoped
 * Completed hold tracker, per-section collapse state, and upstream's
 * older-settled pagination. See `.fork/customizations.yaml#no3y-mobile-redesign`.
 */
import {
  createSidebarV2CompletedHoldTracker,
  type SidebarV2StatusHeaderKey,
  type SidebarV2StatusSectionKey,
} from "./forkStatusGrouping";
import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import type { OlderSettledScope } from "@t3tools/client-runtime/state/threads";
import type { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { useMemo, useState, useSyncExternalStore } from "react";

import { useOlderSettledShelf, useOlderSettledShelfGrowth } from "../src/state/olderSettledShelf";
import type { PendingNewTask } from "../src/state/use-pending-new-tasks";
import { computeThreadMoveAvailability } from "../src/features/threads/threadOrder";
import type { PendingThreadOrder } from "../src/features/threads/threadOrder";
import {
  getThreadListV2OrderedSection,
  threadListInboxReturns,
  threadListV2LayoutTime,
} from "../src/features/threads/threadListV2";
import {
  buildNo3yStatusGroupedList,
  buildScratchProjectKeySet,
  type No3yStatusFilter,
  type No3yThreadSortOrder,
} from "./mobileStatusGrouping";

// Kept at module scope so navigating into a thread and back preserves 5-minute Completed holds.
const mobileCompletedHolds = createSidebarV2CompletedHoldTracker();

function observeInbox(
  threads: Parameters<typeof threadListInboxReturns.observe>[0],
  _expiredGraceVersion: number,
) {
  return threadListInboxReturns.observe(threads);
}

function useKeySet(newlineSeparatedKeys: string): ReadonlySet<string> {
  return useMemo(
    () => new Set(newlineSeparatedKeys.length === 0 ? [] : newlineSeparatedKeys.split("\n")),
    [newlineSeparatedKeys],
  );
}

function olderSettledScopes(input: {
  readonly environmentId: EnvironmentId | null;
  readonly projectRefs: ReadonlyArray<{
    readonly environmentId: EnvironmentId;
    readonly projectId: ProjectId;
  }> | null;
  readonly settlementEnvironmentIds: ReadonlySet<EnvironmentId>;
}): ReadonlyArray<OlderSettledScope> {
  const environmentIds =
    input.environmentId === null ? [...input.settlementEnvironmentIds] : [input.environmentId];
  return environmentIds.flatMap((environmentId): ReadonlyArray<OlderSettledScope> => {
    if (input.projectRefs == null) return [{ environmentId, projectIds: null }];
    const projectIds = input.projectRefs.flatMap((ref) =>
      ref.environmentId === environmentId ? [ref.projectId] : [],
    );
    return projectIds.length === 0 ? [] : [{ environmentId, projectIds }];
  });
}

export function useNo3yStatusGroupedList(input: {
  readonly threads: ReadonlyArray<EnvironmentThreadShell>;
  readonly projects: ReadonlyArray<EnvironmentProject>;
  readonly scratchWorkspaceRootByEnvironmentId: ReadonlyMap<
    EnvironmentId,
    string | null | undefined
  >;
  readonly pendingTasks: ReadonlyArray<PendingNewTask>;
  readonly environmentId: EnvironmentId | null;
  readonly projectRefs: ReadonlyArray<{
    readonly environmentId: EnvironmentId;
    readonly projectId: ProjectId;
  }> | null;
  readonly searchQuery: string;
  readonly searchMatches: ReadonlyMap<string, unknown>;
  readonly statusFilter: No3yStatusFilter;
  readonly sortOrder: No3yThreadSortOrder;
  readonly settlementEnvironmentIds: ReadonlySet<EnvironmentId>;
  readonly snoozeEnvironmentIds: ReadonlySet<EnvironmentId>;
  readonly pinReorderEnvironmentIds: ReadonlySet<EnvironmentId>;
  readonly activeReorderEnvironmentIds: ReadonlySet<EnvironmentId>;
  readonly queuedThreadKeys: ReadonlySet<string>;
  readonly settledLimit: number;
  readonly now: string;
  readonly pendingOrder: PendingThreadOrder | null;
  readonly shelfPreferencesLoaded: boolean;
  readonly snoozedShelfExpanded: boolean;
  readonly settledShelfExpanded: boolean;
  readonly toggleSnoozedShelf: () => void;
  readonly toggleSettledShelf: () => void;
  readonly selectedThreadKey: string | null;
}) {
  const [collapsedSections, setCollapsedSections] = useState<
    ReadonlySet<SidebarV2StatusSectionKey>
  >(() => new Set());

  const toggleSection = (section: SidebarV2StatusHeaderKey) => {
    if (section === "snoozed") {
      input.toggleSnoozedShelf();
      return;
    }
    if (section === "settled") {
      input.toggleSettledShelf();
      return;
    }
    setCollapsedSections((current) => {
      const next = new Set(current);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const scratchProjectKeys = useMemo(
    () => buildScratchProjectKeySet(input.projects, input.scratchWorkspaceRootByEnvironmentId),
    [input.projects, input.scratchWorkspaceRootByEnvironmentId],
  );

  const layoutTime = useMemo(
    () =>
      threadListV2LayoutTime({
        threads: input.threads,
        now: input.now,
        searchQuery: input.searchQuery,
      }),
    [input.threads, input.now, input.searchQuery],
  );

  const inboxVersion = useSyncExternalStore(
    threadListInboxReturns.subscribe,
    threadListInboxReturns.getSnapshot,
  );
  const inbox = useMemo(
    () => observeInbox(input.threads, inboxVersion),
    [input.threads, inboxVersion],
  );

  const moveAvailability = useMemo(() => {
    const pinnedAvailability = computeThreadMoveAvailability({
      allThreads: input.threads,
      section: "pinned",
      pendingOrder: input.pendingOrder,
      reorderableEnvironmentIds: input.pinReorderEnvironmentIds,
      ordered: getThreadListV2OrderedSection({
        threads: input.threads,
        section: "pinned",
        pendingOrder: input.pendingOrder,
        now: layoutTime,
        settlementEnvironmentIds: input.settlementEnvironmentIds,
        snoozeEnvironmentIds: input.snoozeEnvironmentIds,
        queuedThreadKeys: input.queuedThreadKeys,
      }),
    });
    return new Map(pinnedAvailability);
  }, [
    input.threads,
    input.pendingOrder,
    input.pinReorderEnvironmentIds,
    layoutTime,
    input.settlementEnvironmentIds,
    input.snoozeEnvironmentIds,
    input.queuedThreadKeys,
  ]);

  const scopes = useMemo(
    () =>
      olderSettledScopes({
        environmentId: input.environmentId,
        projectRefs: input.projectRefs,
        settlementEnvironmentIds: input.settlementEnvironmentIds,
      }),
    [input.environmentId, input.projectRefs, input.settlementEnvironmentIds],
  );

  const olderSettledShelf = useOlderSettledShelf({
    scopes,
    expanded: input.settledShelfExpanded,
    visibleCount: input.searchQuery.trim().length === 0 ? input.settledLimit : 0,
  });
  const { isListed, unloadedCount } = olderSettledShelf;

  const grouped = useMemo(
    () =>
      buildNo3yStatusGroupedList({
        threads: input.threads.filter((thread) => thread.archivedAt === null),
        pendingTasks: input.pendingTasks,
        environmentId: input.environmentId,
        projectRefs: input.projectRefs,
        searchQuery: input.searchQuery,
        matchedThreadKeys: new Set(input.searchMatches.keys()),
        statusFilter: input.statusFilter,
        sortOrder: input.sortOrder,
        collapsedSections,
        snoozedShelfExpanded: input.snoozedShelfExpanded,
        settledShelfExpanded: input.settledShelfExpanded,
        shelfPreferencesLoading: !input.shelfPreferencesLoaded,
        settledLimit: input.settledLimit,
        now: layoutTime,
        snoozeLabelNow: `${input.now.slice(0, 16)}:00.000Z`,
        openThreadKey: input.selectedThreadKey,
        holds: mobileCompletedHolds,
        returnedAt: inbox.returnedAt,
        settlementEnvironmentIds: input.settlementEnvironmentIds,
        snoozeEnvironmentIds: input.snoozeEnvironmentIds,
        queuedThreadKeys: input.queuedThreadKeys,
        moveAvailability,
        isListedSettled: isListed,
        unloadedSettledCount: unloadedCount(
          input.threads.filter(
            (thread) =>
              thread.archivedAt === null &&
              scopes.some(
                (scope) =>
                  scope.environmentId === thread.environmentId &&
                  (scope.projectIds === null || scope.projectIds.includes(thread.projectId)),
              ),
          ),
        ),
        excludeChatThreads: true,
        scratchProjectKeys,
      }),
    [
      input.threads,
      input.pendingTasks,
      input.environmentId,
      input.projectRefs,
      input.searchQuery,
      input.searchMatches,
      input.statusFilter,
      input.sortOrder,
      collapsedSections,
      input.snoozedShelfExpanded,
      input.settledShelfExpanded,
      input.shelfPreferencesLoaded,
      input.settledLimit,
      layoutTime,
      input.now,
      input.selectedThreadKey,
      inbox.returnedAt,
      input.settlementEnvironmentIds,
      input.snoozeEnvironmentIds,
      input.queuedThreadKeys,
      moveAvailability,
      isListed,
      unloadedCount,
      scopes,
      scratchProjectKeys,
    ],
  );

  useOlderSettledShelfGrowth(olderSettledShelf, grouped.listedSettledThreads);
  const contentOnlyThreadKeys = useKeySet([...grouped.contentOnlyThreadKeys].sort().join("\n"));

  return {
    items: grouped.items,
    hiddenSettledCount: grouped.hiddenSettledCount,
    settledCount: grouped.settledCount,
    contentOnlyThreadKeys,
    olderSettledShelf,
    toggleSection,
  };
}
