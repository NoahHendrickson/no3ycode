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

interface ProjectRef {
  readonly environmentId: string;
  readonly projectId: string;
}

function projectKeyLookup(projectGroups: readonly SidebarV2GroupableProject[]) {
  const projectKeyByRef = new Map<string, string>();
  for (const group of projectGroups) {
    for (const ref of group.memberProjectRefs) {
      projectKeyByRef.set(`${ref.environmentId}:${ref.projectId}`, group.projectKey);
    }
  }
  return (ref: ProjectRef) => projectKeyByRef.get(`${ref.environmentId}:${ref.projectId}`) ?? null;
}

function collapsedTabMaker(projectGroups: readonly SidebarV2GroupableProject[]) {
  const projectKeyOf = projectKeyLookup(projectGroups);
  return (thread: EnvironmentThreadShell): CollapsedThreadTab => ({
    thread,
    threadKey: scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id)),
    projectKey: projectKeyOf(thread),
  });
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
  readonly holds: SidebarV2CompletedHoldTracker;
  /** The sidebar's capability gates: an environment without them never parks a thread. */
  readonly supports: (environmentId: EnvironmentThreadShell["environmentId"]) => {
    readonly settlement: boolean;
    readonly snooze: boolean;
  };
}): { readonly tabs: CollapsedThreadTab[]; readonly projects: TProject[] } {
  // The open thread keeps its tab whatever its status, settled or snoozed included, so
  // collapsing the sidebar never hides it.
  const isOpen = (thread: EnvironmentThreadShell) =>
    scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id)) === input.openThreadKey;
  const live = input.threads.filter(
    (thread) => isOpen(thread) || !collapsedThreadShelved(thread, input),
  );
  const sections = buildSidebarV2StatusSections({
    threads: live,
    localLastVisitedAtById: input.localLastVisitedAtById,
    now: input.now,
    openThreadKey: input.openThreadKey,
    holds: input.holds,
    isDraft: () => false,
  });
  const toTab = collapsedTabMaker(input.projectGroups);
  const tabs = sections.flatMap((section) => {
    const sectionTabs = section.threads.map(toTab);
    return isCollapsedTabStatus(section.status) && input.statuses.has(section.status)
      ? sectionTabs
      : sectionTabs.filter((tab) => tab.threadKey === input.openThreadKey);
  });
  const projectKeys = new Set(tabs.map((tab) => tab.projectKey));
  return {
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

/** Settled or snoozed, under the sidebar's capability gates: never a tab, and never split by a
    drag, as the sidebar's shelf rows are not. */
export function collapsedThreadShelved(
  thread: EnvironmentThreadShell,
  input: Pick<Parameters<typeof buildCollapsedThreadTabs>[0], "now" | "supports">,
): boolean {
  const supports = input.supports(thread.environmentId);
  return (
    (supports.settlement && thread.settledOverride === "settled") ||
    (supports.snooze && effectiveSnoozed(thread, { now: input.now }))
  );
}

export type CollapsedPaneTab =
  | { readonly kind: "thread"; readonly tab: CollapsedThreadTab }
  | {
      readonly kind: "draft";
      readonly threadKey: string;
      readonly pane: number;
      readonly projectKey: string | null;
    };

/**
 * Each split pane's tab, left then right, whatever its status: its thread's once the server has
 * the thread, else its draft (unsent, or sent and waiting for the shell), else none. Drafts are
 * looked up per pane, since the route names only the focused pane's.
 */
export function collapsedPaneTabs(input: {
  /** Already filtered to the threads the sidebar lists. */
  readonly threads: readonly EnvironmentThreadShell[];
  readonly projectGroups: readonly SidebarV2GroupableProject[];
  readonly paneThreadKeys: readonly string[];
  /** Each pane's draft, or null. */
  readonly paneDrafts: readonly (ProjectRef | null)[];
}): CollapsedPaneTab[] {
  if (input.paneThreadKeys.length === 0) return [];
  const toTab = collapsedTabMaker(input.projectGroups);
  const projectKeyOf = projectKeyLookup(input.projectGroups);
  const tabByKey = new Map(
    input.threads
      .map(toTab)
      .filter((tab) => input.paneThreadKeys.includes(tab.threadKey))
      .map((tab) => [tab.threadKey, tab]),
  );
  return input.paneThreadKeys.flatMap((threadKey, pane): CollapsedPaneTab[] => {
    const tab = tabByKey.get(threadKey);
    if (tab !== undefined) return [{ kind: "thread", tab }];
    const draft = input.paneDrafts[pane] ?? null;
    return draft === null
      ? []
      : [{ kind: "draft", threadKey, pane, projectKey: projectKeyOf(draft) }];
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
 * The tab to open when the project filter changes: the new filter's first tab, unless the new
 * filter is All or holds the open view, a split's panes or the open tab.
 */
export function collapsedFilterSwitchTarget<TTab>(input: {
  readonly after: readonly TTab[];
  readonly nextProjectKey: string;
  /** Null when nothing pins the view: a draft, or a thread without a shown tab. */
  readonly openProjectKeys: readonly (string | null)[] | null;
}): TTab | null {
  const { openProjectKeys, nextProjectKey } = input;
  if (
    openProjectKeys === null ||
    nextProjectKey === ALL_PROJECTS ||
    openProjectKeys.includes(nextProjectKey)
  ) {
    return null;
  }
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

/** Widths with the same bucket fit every count alike (fitCollapsedThreadTabs reads the width
    only through these), so a resize frame inside one bucket can keep the previous width. */
export function collapsedTabWidthBucket(width: number): string {
  const step = COLLAPSED_TAB_MIN_WIDTH + COLLAPSED_TAB_GAP;
  if (width <= 0) return "none";
  return `${Math.floor((width + COLLAPSED_TAB_GAP) / step)}:${Math.floor((width - COLLAPSED_TAB_MORE_WIDTH) / step)}`;
}

export type CollapsedTabSlot<TEntry> =
  | { readonly kind: "tab"; readonly entry: TEntry }
  /** A split's pane tabs side by side in one capsule, both selected. */
  | { readonly kind: "pair"; readonly entries: readonly TEntry[] };

/**
 * The strip's row: the leading draft, then the thread tabs with a split's panes in place of the
 * first of them to hold a tab, fitted to the width. The open thread (or the split's panes) stays
 * on screen as fitCollapsedThreadTabs allows; the rest go behind More.
 */
export function layoutCollapsedTabRow<TEntry extends { readonly threadKey: string }>(input: {
  /** The route's draft, when it is not one of the panes. */
  readonly leading: TEntry | null;
  readonly tabs: readonly TEntry[];
  /** A split's pane tabs, left then right; empty outside a split. */
  readonly panes: readonly TEntry[];
  /** The route's thread or draft, kept on screen outside a split. */
  readonly openKey: string | null;
  readonly width: number;
}): { readonly slots: CollapsedTabSlot<TEntry>[]; readonly overflow: TEntry[] } {
  const { leading, panes } = input;
  const { before, after } = splitCollapsedTabsAroundPanes(
    input.tabs,
    panes.map((pane) => pane.threadKey),
  );
  const entries = [...(leading === null ? [] : [leading]), ...before, ...panes, ...after];
  const panesStart = (leading === null ? 0 : 1) + before.length;
  const [activeIndex, activeLength] =
    panes.length > 0
      ? [panesStart, panes.length]
      : [entries.findIndex((entry) => entry.threadKey === input.openKey), 1];
  const fit = fitCollapsedThreadTabs({
    count: entries.length,
    width: input.width,
    activeIndex,
    activeLength,
  });
  const slots: CollapsedTabSlot<TEntry>[] = [];
  let pair: TEntry[] | null = null;
  for (const index of fit.visible) {
    const entry = entries[index];
    if (entry === undefined) continue;
    if (panes.length < 2 || index < panesStart || index >= panesStart + panes.length) {
      slots.push({ kind: "tab", entry });
    } else if (pair === null) {
      pair = [entry];
      slots.push({ kind: "pair", entries: pair });
    } else {
      pair.push(entry);
    }
  }
  return { slots, overflow: fit.overflow.flatMap((index) => entries[index] ?? []) };
}
