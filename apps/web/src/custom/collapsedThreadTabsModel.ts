/** Which threads the collapsed-sidebar tabs show (fork-collapsed-thread-tabs): Needs input,
 * Completed and Working by default, Idle on request, in that order, from status grouping's own
 * pipeline so a tab and its sidebar card always agree, Completed hold included. */
import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { effectiveSnoozed } from "@t3tools/client-runtime/state/thread-settled";

import type { DraftSessionState } from "../composerDraftStore";
import type { SidebarV2GroupableProject } from "./sidebarV2ProjectGrouping";
import {
  buildSidebarV2StatusSections,
  type SidebarV2CompletedHoldTracker,
  type SidebarV2StatusBucket,
} from "./sidebarV2StatusGrouping";

/** The statuses the tab menu offers, in tab order. Settled is never offered. */
export const COLLAPSED_TAB_STATUSES = ["input", "done", "working", "idle"] as const;
export type CollapsedThreadTabStatus = (typeof COLLAPSED_TAB_STATUSES)[number];
const isCollapsedTabStatus = (status: SidebarV2StatusBucket): status is CollapsedThreadTabStatus =>
  (COLLAPSED_TAB_STATUSES as readonly string[]).includes(status);
export const DEFAULT_COLLAPSED_TAB_STATUSES: readonly CollapsedThreadTabStatus[] = [
  "input",
  "done",
  "working",
];

export interface CollapsedThreadTab {
  readonly thread: EnvironmentThreadShell;
  readonly threadKey: string;
  readonly projectKey: string | null;
}

export function buildCollapsedThreadTabs<TProject extends SidebarV2GroupableProject>(input: {
  /** Already filtered to the threads the sidebar lists (filterSidebarV2VisibleThreads). */
  readonly threads: readonly EnvironmentThreadShell[];
  readonly projectGroups: readonly TProject[];
  readonly statuses: ReadonlySet<CollapsedThreadTabStatus>;
  readonly localLastVisitedAtById: Readonly<Record<string, string>>;
  /** A precise ISO time, as the sidebar's partition uses. */
  readonly now: string;
  readonly openThreadKey: string | null;
  /** A split's threads, left (the one it was split from) then right: they show whatever their status. */
  readonly paneThreadKeys: readonly string[];
  readonly holds: SidebarV2CompletedHoldTracker;
  /** The sidebar's capability gates: an environment without them never parks a thread. */
  readonly supports: (environmentId: EnvironmentThreadShell["environmentId"]) => {
    readonly settlement: boolean;
    readonly snooze: boolean;
  };
}): {
  readonly panes: CollapsedThreadTab[];
  readonly tabs: CollapsedThreadTab[];
  readonly projects: TProject[];
} {
  const live = input.threads.filter((thread) => {
    const supports = input.supports(thread.environmentId);
    return !(
      (supports.settlement && thread.settledOverride === "settled") ||
      (supports.snooze && effectiveSnoozed(thread, { now: input.now }))
    );
  });
  const sections = buildSidebarV2StatusSections({
    threads: live,
    localLastVisitedAtById: input.localLastVisitedAtById,
    now: input.now,
    openThreadKey: input.openThreadKey,
    holds: input.holds,
    isDraft: () => false,
  });
  const projectKeyByRef = new Map<string, string>();
  for (const group of input.projectGroups) {
    for (const ref of group.memberProjectRefs) {
      projectKeyByRef.set(`${ref.environmentId}:${ref.projectId}`, group.projectKey);
    }
  }
  const toTab = (thread: EnvironmentThreadShell): CollapsedThreadTab => ({
    thread,
    threadKey: scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id)),
    projectKey: projectKeyByRef.get(`${thread.environmentId}:${thread.projectId}`) ?? null,
  });
  const panes = input.paneThreadKeys.flatMap((key) => {
    const thread = input.threads.find(
      (candidate) => scopedThreadKey(scopeThreadRef(candidate.environmentId, candidate.id)) === key,
    );
    return thread === undefined ? [] : [toTab(thread)];
  });
  const tabs = sections
    .filter((section) => isCollapsedTabStatus(section.status) && input.statuses.has(section.status))
    .flatMap((section) => section.threads)
    .map(toTab);
  const projectKeys = new Set(tabs.map((tab) => tab.projectKey));
  return {
    panes,
    tabs,
    projects: input.projectGroups.filter((group) => projectKeys.has(group.projectKey)),
  };
}

/**
 * The open draft's thread key when it gets the leading tab: open and unsent, and not already a
 * thread tab (mid-promotion, its reserved id has a server shell), else null.
 */
export function collapsedDraftTabKey(input: {
  readonly draft: Pick<DraftSessionState, "environmentId" | "threadId" | "promotedTo"> | null;
  readonly tabs: readonly { readonly threadKey: string }[];
}): string | null {
  const { draft } = input;
  if (draft === null || draft.promotedTo != null) return null;
  const threadKey = scopedThreadKey(scopeThreadRef(draft.environmentId, draft.threadId));
  return input.tabs.some((tab) => tab.threadKey === threadKey) ? null : threadKey;
}

/**
 * Each split pane's tab, left then right: its unsent draft whichever pane holds the route (the
 * route names only the focused pane's), else its thread.
 */
export function collapsedPaneTabs<
  TDraft extends {
    readonly session: Pick<DraftSessionState, "environmentId" | "threadId" | "promotedTo">;
  },
>(input: {
  readonly paneThreadKeys: readonly string[];
  readonly paneDrafts: readonly (TDraft | null)[];
  readonly panes: readonly CollapsedThreadTab[];
}): (TDraft | CollapsedThreadTab)[] {
  return input.paneThreadKeys.flatMap((key, index): (TDraft | CollapsedThreadTab)[] => {
    const draft = input.paneDrafts[index] ?? null;
    if (
      draft !== null &&
      collapsedDraftTabKey({ draft: draft.session, tabs: input.panes }) === key
    ) {
      return [draft];
    }
    return input.panes.filter((tab) => tab.threadKey === key);
  });
}

/** The project filter's value for every project. */
export const ALL_PROJECTS = "all";

/**
 * The tabs' filter for the scope the sidebar shows as it collapses: its one project, else All,
 * and All too when that project doesn't hold the open thread, whose tab it would hide. An
 * unscoped sidebar hands nothing over, so the strip keeps its own saved choice.
 */
export function collapsedTabProjectForScope<TProject extends SidebarV2GroupableProject>(input: {
  readonly scope: readonly TProject[];
  readonly openThread: Pick<EnvironmentThreadShell, "environmentId" | "projectId"> | null;
}): string | null {
  const [only, ...rest] = input.scope;
  if (only === undefined) return null;
  const { openThread } = input;
  const holdsOpenThread =
    openThread === null ||
    only.memberProjectRefs.some(
      (ref) =>
        ref.environmentId === openThread.environmentId && ref.projectId === openThread.projectId,
    );
  return rest.length === 0 && holdsOpenThread ? only.projectKey : ALL_PROJECTS;
}

/**
 * The tab to open when the project filter changes: the new filter's first tab, but only when
 * the open thread had a tab before and the new filter hides it. A thread that never had a tab
 * stays open, and so does a draft, whose tab shows under every filter.
 */
export function collapsedFilterSwitchTarget<TTab extends { readonly threadKey: string }>(input: {
  readonly before: readonly TTab[];
  readonly after: readonly TTab[];
  readonly openThreadKey: string | null;
  readonly draftOpen: boolean;
}): TTab | null {
  const isOpen = (tab: TTab) => tab.threadKey === input.openThreadKey;
  if (input.draftOpen || !input.before.some(isOpen) || input.after.some(isOpen)) return null;
  return input.after[0] ?? null;
}

/**
 * The tabs either side of a split's group, which takes the place of the first of its threads to
 * hold a tab, so the thread split from keeps its spot with the new one on its right. With
 * neither holding one, the group leads the row.
 */
export function splitCollapsedTabsAroundPanes<TTab extends { readonly threadKey: string }>(
  tabs: readonly TTab[],
  paneThreadKeys: readonly string[],
): { readonly before: TTab[]; readonly after: TTab[] } {
  const isPane = (tab: TTab) => paneThreadKeys.includes(tab.threadKey);
  const at = Math.max(0, tabs.findIndex(isPane));
  return {
    before: tabs.slice(0, at).filter((tab) => !isPane(tab)),
    after: tabs.slice(at).filter((tab) => !isPane(tab)),
  };
}

/**
 * The tab minimum both tab shells set inline, which holds the provider mark, a five-digit PR
 * badge, the status mark and the hover actions. The gap and More width match the strip's
 * gap-1.5 and w-[72px] classes.
 */
export const COLLAPSED_TAB_MIN_WIDTH = 132;
const COLLAPSED_TAB_GAP = 6;
const COLLAPSED_TAB_MORE_WIDTH = 72;

/**
 * How many tabs fit at their minimum width, the rest going behind More. The open
 * thread (a split's whole group) takes the last visible slots when it would overflow; with no slot at all (narrower
 * than one tab plus More), More keeps the room, and the header still names the thread.
 * An unmeasured row (width 0) shows every tab.
 */
export function fitCollapsedThreadTabs(input: {
  readonly count: number;
  readonly width: number;
  readonly activeIndex: number;
  /** Tabs from activeIndex on that stay visible together. */
  readonly activeLength: number;
}): { readonly visible: number[]; readonly overflow: number[] } {
  const all = Array.from({ length: input.count }, (_, index) => index);
  const step = COLLAPSED_TAB_MIN_WIDTH + COLLAPSED_TAB_GAP;
  const width = input.width;
  if (width <= 0 || input.count * step - COLLAPSED_TAB_GAP <= width) {
    return { visible: all, overflow: [] };
  }
  const fit = Math.max(0, Math.floor((width - COLLAPSED_TAB_MORE_WIDTH) / step));
  const activeEnd = input.activeIndex + input.activeLength;
  const visible =
    input.activeIndex >= 0 && activeEnd > fit
      ? [
          ...all.slice(0, Math.max(0, fit - input.activeLength)),
          ...all.slice(input.activeIndex, activeEnd).slice(0, fit),
        ]
      : all.slice(0, fit);
  const shown = new Set(visible);
  return { visible, overflow: all.filter((index) => !shown.has(index)) };
}
