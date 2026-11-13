/** Collapsed-sidebar thread tabs: Needs input, Completed and Working threads in a row above the
 * thread panes, filtered by project, the overflow behind More, New agent last. See
 * `.fork/customizations.yaml#fork-collapsed-thread-tabs`. Renders only while collapsed. */
import { useAtomValue } from "@effect/atom-react";
import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import { threadWokeAt } from "@t3tools/client-runtime/state/thread-settled";
import {
  resolveThreadCurrentPullRequestLink,
  resolveThreadPullRequestBadge,
} from "@t3tools/client-runtime/thread-pull-requests";
import { useRouter } from "@tanstack/react-router";
import * as Schema from "effect/Schema";
import { useShallow } from "zustand/react/shallow";
import { useState, type CSSProperties, type MouseEvent } from "react";
import { flushSync } from "react-dom";

import { ProjectFavicon, type ProjectFaviconProject } from "~/components/ProjectFavicon";
import {
  filterSidebarV2VisibleThreads,
  resolveThreadLastVisitedAt,
} from "~/components/Sidebar.logic";
import {
  ThreadPullRequestBadgeControl,
  prStatusIndicator,
  useLinkedThreadPullRequest,
} from "~/components/ThreadStatusIndicators";
import { InlineButton } from "~/components/ui/button";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuTrigger,
} from "~/components/ui/menu";
import { useSidebar, useSidebarVisibility } from "~/components/ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { useNowMinute } from "~/hooks/useNowMinute";
import { useSupportsMultiplePullRequests } from "~/hooks/useSupportsMultiplePullRequests";
import { useOpenPrLink } from "~/lib/openPullRequestLink";
import { anchoredMenuPosition } from "./anchoredContextMenu";
import { isInletActive } from "./forkActivePalette";
import { useRightPanelStore } from "~/rightPanelStore";
import { useSnoozeWakeClock } from "~/components/Sidebar.logic";
import { useSidebarProjectGroups } from "~/hooks/useSidebarProjectGroups";
import { useThreadRouteTarget } from "~/hooks/useThreadRouteTarget";
import { useComposerDraftStore, type DraftId, type DraftSessionState } from "~/composerDraftStore";
import { replaceComposerContextReferences } from "@t3tools/shared/composerContextReferences";
import { releaseComposerDraftUploads } from "~/lib/composerDraftUploads";
import { shortcutLabelForCommand } from "~/keybindings";
import { observeResize } from "~/lib/observeResize";
import { cn } from "~/lib/utils";
import {
  useDelegatedUnderParent,
  useProjects,
  useQuietThreadShells,
  useServerConfigs,
} from "~/state/entities";
import { useEnvironmentProviders } from "~/state/environments";
import {
  deriveProviderEntriesByEnvironment,
  NO_PROVIDER_MODEL_SELECTION,
  type ProviderInstanceEntry,
} from "~/providerInstances";
import { primaryServerKeybindingsAtom } from "~/state/server";
import { settleAndAdvance } from "~/settleAndAdvance";
import { buildThreadRouteParams } from "~/threadRoutes";
import { useUiStateStore } from "~/uiStateStore";
import { useThreadSelectionStore } from "~/threadSelectionStore";
import type { EnvironmentId, ModelSelection, ScopedThreadRef } from "@t3tools/contracts";

import {
  ALL_PROJECTS,
  buildCollapsedThreadTabs,
  collapsedDraftTabKey,
  collapsedFilterSwitchTarget,
  collapsedPaneTabs,
  collapsedTabCapacity,
  collapsedThreadShelved,
  COLLAPSED_TAB_MIN_WIDTH,
  COLLAPSED_TAB_STATUSES,
  DEFAULT_COLLAPSED_TAB_STATUSES,
  layoutCollapsedTabRow,
  sameCollapsedTabCapacity,
  type CollapsedTabCapacity,
  type CollapsedThreadTab,
  type CollapsedThreadTabStatus,
} from "./collapsedThreadTabsModel";
import { useCollapsedTabsProjectFilter } from "./collapsedThreadTabsProjectFilter";
import {
  CheckIcon,
  ChevronDownIcon,
  EllipsisIcon,
  LayersIcon,
  PlusIcon,
  XIcon,
} from "./icons/lucide-phosphor";
import {
  FORK_MARK_INK_BY_DRIVER,
  ModelPickerProviderGlyph,
} from "./icons/ModelPickerProviderGlyph";
import { SegmentedTab, SegmentedTabs } from "./SegmentedTabs";
import { ScopeCheckboxItem } from "./SidebarV2ChromeRows";
import { openSidebarThreadMenu, startSidebarThreadInProject } from "./sidebarActionsBridge";
import { SIDEBAR_V2_ICON_BUTTON_CLASS } from "./sidebarV2TrailingColumn";
import { makeSplitDropHandlers, splitThreadDragSourceProps } from "./splitThreads/splitThreadDrag";
import { resolveSidebarV2CardStatus } from "./sidebarV2CardStatus";
import { SidebarV2StatusMark } from "./SidebarV2StatusIndicator";
import { sidebarDraftModelSelection, sidebarDraftTitleFromPrompt } from "./sidebarV2DraftRows";
import type { SidebarV2GroupableProject } from "./sidebarV2ProjectGrouping";
import {
  createSidebarV2CompletedHoldTracker,
  SIDEBAR_V2_STATUS_SECTION_LABELS,
} from "./sidebarV2StatusGrouping";
import { useStartNewAgentDraft } from "./useNewAgentDraft";
import { forkThreadTabsRef } from "./forkStageStamps";

const STATUSES_STORAGE_KEY = "t3code:fork:collapsed-thread-tabs-statuses:v1";
const StoredStatuses = Schema.Array(Schema.Literals(COLLAPSED_TAB_STATUSES));
// Shrinks from its title's width to the minimum fitCollapsedThreadTabs counts on.
const TAB_SHELL_CLASS =
  "group/tab relative flex h-7 max-w-56 shrink items-center rounded-full text-xs font-medium";
const TAB_SHELL_STYLE = { minWidth: COLLAPSED_TAB_MIN_WIDTH };
const TAB_ACTION_CLASS = cn(SIDEBAR_V2_ICON_BUTTON_CLASS, "size-5 rounded-full");
const ACTIVE_TAB_CLASS = "bg-black/10 text-foreground dark:bg-white/16";
// No group/tab: each half's hover actions answer to that half alone. Its minimum is its
// halves' (one fitCollapsedThreadTabs slot each), so it never shrinks under them.
const SPLIT_TAB_CLASS = cn(
  "relative flex h-7 shrink items-center rounded-full text-xs font-medium",
  ACTIVE_TAB_CLASS,
);

// Its own tracker: the sidebar's resets whenever status grouping is off.
const completedHolds = createSidebarV2CompletedHoldTracker();
const NO_PROJECT_GROUPS: readonly SidebarV2GroupableProject[] = [];
const DEFAULT_STATUS_SET = new Set(DEFAULT_COLLAPSED_TAB_STATUSES);
const STATUS_MENU_LABEL = "Choose which threads show as tabs";

const clearSidebarSelection = () => {
  const selection = useThreadSelectionStore.getState();
  if (selection.hasSelection()) selection.clearSelection();
};

type TabStatus = ReturnType<typeof resolveSidebarV2CardStatus>["topStatus"];

export function CollapsedThreadTabs(props: {
  /** A split's two threads, left then right, which share one capsule; empty outside a split. */
  readonly paneThreadRefs: readonly ScopedThreadRef[];
}) {
  const { isMobile } = useSidebar();
  const sidebarVisible = useSidebarVisibility();
  if (isMobile) return null;
  // The tracker keeps watching under an open sidebar, so a thread that comes to rest
  // there is still held in Completed when the sidebar collapses.
  if (sidebarVisible) return <CompletedHoldObserver />;
  return <CollapsedThreadTabsStrip paneThreadRefs={props.paneThreadRefs} />;
}

/** The tab pipeline's inputs, shared by the strip and the observer that feeds its tracker. */
function useTabSource() {
  const threads = useQuietThreadShells();
  const delegatedUnderParent = useDelegatedUnderParent();
  const serverConfigs = useServerConfigs();
  const localLastVisitedAtById = useUiStateStore((store) => store.threadLastVisitedAtById);
  const routeTarget = useThreadRouteTarget();
  return {
    threads: filterSidebarV2VisibleThreads(threads, null, delegatedUnderParent),
    localLastVisitedAtById,
    // The minute re-reads it for hold expiry, the wake clock at each snooze deadline.
    now: preciseNow(useNowMinute(), useSnoozeWakeClock(threads)),
    openThreadKey: routeTarget?.kind === "server" ? scopedThreadKey(routeTarget.threadRef) : null,
    holds: completedHolds,
    supports: (environmentId: EnvironmentId) => {
      const capabilities = serverConfigs.get(environmentId)?.environment.capabilities;
      return {
        settlement: capabilities?.threadSettlement === true,
        snooze: capabilities?.threadSnooze === true,
      };
    },
  };
}

/** The real time as ISO, for snooze checks: the minute clock carries no zone. Its
    arguments are only the clocks that should re-read it. */
function preciseNow(_minute: string, _wakeClockMs: number): string {
  return new Date().toISOString();
}

function CompletedHoldObserver() {
  buildCollapsedThreadTabs({
    ...useTabSource(),
    projectGroups: NO_PROJECT_GROUPS,
    statuses: DEFAULT_STATUS_SET,
  });
  return null;
}

type StripEntry =
  | {
      readonly kind: "draft";
      readonly draftId: DraftId;
      readonly threadKey: string;
      readonly environmentId: EnvironmentId;
      readonly project: ProjectFaviconProject | null;
      readonly defaultModelSelection: ModelSelection;
    }
  | {
      readonly kind: "thread";
      readonly threadKey: string;
      readonly tab: CollapsedThreadTab;
      readonly project: ProjectFaviconProject | null;
    };

function CollapsedThreadTabsStrip(props: { readonly paneThreadRefs: readonly ScopedThreadRef[] }) {
  const paneThreadKeys = props.paneThreadRefs.map(scopedThreadKey);
  // Looked up by each pane's own thread: the route names only the focused pane's draft.
  const paneDraftIds = useComposerDraftStore(
    useShallow((store) => props.paneThreadRefs.map((ref) => store.getDraftIdByRef(ref))),
  );
  const paneDraftSessions = useComposerDraftStore(
    useShallow((store) =>
      paneDraftIds.map((draftId) => (draftId === null ? null : store.getDraftSession(draftId))),
    ),
  );
  const router = useRouter();
  const serverConfigs = useServerConfigs();
  const providersByEnvironment = useEnvironmentProviders();
  const projectGroups = useSidebarProjectGroups();
  const allProjects = useProjects();
  const source = useTabSource();
  const { localLastVisitedAtById, now, openThreadKey } = source;
  const [storedProjectKey, setStoredProjectKey] = useCollapsedTabsProjectFilter();
  const [storedStatuses, setStoredStatuses] = useLocalStorage(
    STATUSES_STORAGE_KEY,
    DEFAULT_COLLAPSED_TAB_STATUSES,
    StoredStatuses,
  );
  const statuses = new Set(storedStatuses);
  const toggleStatus = (status: CollapsedThreadTabStatus) =>
    setStoredStatuses((previous) =>
      COLLAPSED_TAB_STATUSES.filter((option) =>
        option === status ? !previous.includes(option) : previous.includes(option),
      ),
    );
  // The sidebar's New agent row: the unassigned draft, its project picked in the column.
  const startNewAgentDraft = useStartNewAgentDraft();
  const newAgentShortcutLabel = shortcutLabelForCommand(
    useAtomValue(primaryServerKeybindingsAtom),
    "chat.new",
  );
  const [navCapacity, setNavCapacity] = useState<CollapsedTabCapacity>(null);
  // Created once so the ref never re-subscribes.
  const [measureNav] = useState(
    () => (node: HTMLElement | null) =>
      node === null
        ? undefined
        : observeResize(node, (entries) => {
            const capacity = collapsedTabCapacity(entries.at(-1)?.contentRect.width ?? 0);
            // A resize frame that fits the same tabs keeps the state, so the strip skips it.
            setNavCapacity((previous) =>
              sameCollapsedTabCapacity(previous, capacity) ? previous : capacity,
            );
          }),
  );

  const { tabs, projects } = buildCollapsedThreadTabs({ ...source, projectGroups, statuses });
  // A project that drops out of the strip falls back to All without forgetting the choice.
  const projectKey = projects.some((project) => project.projectKey === storedProjectKey)
    ? storedProjectKey
    : ALL_PROJECTS;
  const tabsIn = (key: string) =>
    key === ALL_PROJECTS ? tabs : tabs.filter((tab) => tab.projectKey === key);
  const shownTabs = tabsIn(projectKey);
  // Filtered to a project, the plus starts in it through the sidebar's own in-project path.
  const filteredProject = projects.find((project) => project.projectKey === projectKey) ?? null;
  const newAgentLabel = filteredProject
    ? `New agent in ${filteredProject.displayName}`
    : "New agent";
  const startNewAgent = () => {
    if (filteredProject && startSidebarThreadInProject(filteredProject.projectKey)) return;
    void startNewAgentDraft();
  };
  // The open draft (the plus lands on one) gets the first tab until its first send turns it into
  // a thread, whatever the project filter.
  const routeTarget = useThreadRouteTarget();
  const openDraftId = routeTarget?.kind === "draft" ? routeTarget.draftId : null;
  const openDraft = useComposerDraftStore((store) =>
    openDraftId === null ? null : store.getDraftSession(openDraftId),
  );
  // A split's panes show under any filter, whatever their status.
  const paneTabs = collapsedPaneTabs({
    threads: source.threads,
    projectGroups,
    paneThreadKeys,
    paneDrafts: paneDraftSessions,
  });
  const draftThreadKey = collapsedDraftTabKey({
    draft: openDraft,
    tabs: [...paneTabs.flatMap((pane) => (pane.kind === "thread" ? [pane.tab] : [])), ...tabs],
  });
  // One rule for every tab: it names its project unless the filter already does.
  const projectMarkFor = (key: string | null) =>
    key === projectKey ? null : (projectGroups.find((group) => group.projectKey === key) ?? null);
  const draftEntryFor = (
    draftId: DraftId,
    draft: DraftSessionState,
    threadKey: string,
  ): Extract<StripEntry, { readonly kind: "draft" }> => {
    const group =
      projectGroups.find((candidate) =>
        candidate.memberProjectRefs.some(
          (ref) => ref.environmentId === draft.environmentId && ref.projectId === draft.projectId,
        ),
      ) ?? null;
    return {
      kind: "draft",
      draftId,
      threadKey,
      environmentId: draft.environmentId,
      project: projectMarkFor(group?.projectKey ?? null),
      // The sidebar's draft card falls back to the project's default model.
      defaultModelSelection:
        allProjects.find(
          (project) =>
            project.environmentId === draft.environmentId && project.id === draft.projectId,
        )?.defaultModelSelection ?? NO_PROVIDER_MODEL_SELECTION,
    };
  };
  const threadEntry = (tab: CollapsedThreadTab): StripEntry => ({
    kind: "thread",
    threadKey: tab.threadKey,
    tab,
    project: projectMarkFor(tab.projectKey),
  });
  const draftEntry =
    openDraftId !== null && openDraft !== null && draftThreadKey !== null
      ? draftEntryFor(openDraftId, openDraft, draftThreadKey)
      : null;
  const paneEntries = paneTabs.flatMap((pane): StripEntry[] => {
    if (pane.kind === "thread") return [threadEntry(pane.tab)];
    const draftId = paneDraftIds[pane.pane] ?? null;
    const session = paneDraftSessions[pane.pane] ?? null;
    return draftId === null || session === null
      ? []
      : [draftEntryFor(draftId, session, pane.threadKey)];
  });
  const row = layoutCollapsedTabRow<StripEntry>({
    leading:
      draftEntry !== null && !paneThreadKeys.includes(draftEntry.threadKey) ? draftEntry : null,
    tabs: shownTabs.map(threadEntry),
    panes: paneEntries,
    openKey: openThreadKey ?? draftEntry?.threadKey ?? null,
    capacity: navCapacity,
  });
  const discardDraft = (draftId: DraftId) => {
    // Home would start a fresh draft, so fall back to the most recent thread.
    const next =
      shownTabs[0]?.thread ??
      source.threads.reduce<(typeof source.threads)[number] | null>(
        (latest, thread) =>
          latest === null || thread.updatedAt > latest.updatedAt ? thread : latest,
        null,
      );
    void (async () => {
      // Leave first, then clear: clearing while still on /draft/$id races the
      // missing-session redirect into a fresh draft (the sidebar's discard does the same).
      if (next) {
        clearSidebarSelection();
        await router.navigate({
          to: "/$environmentId/$threadId",
          params: buildThreadRouteParams(scopeThreadRef(next.environmentId, next.id)),
          replace: true,
        });
      } else {
        await router.navigate({ to: "/", replace: true });
      }
      releaseComposerDraftUploads(draftId);
      useComposerDraftStore.getState().clearDraftThread(draftId);
    })();
  };

  const statusOf = ({ thread, threadKey }: CollapsedThreadTab): TabStatus =>
    resolveSidebarV2CardStatus(thread, {
      lastVisitedAt: resolveThreadLastVisitedAt(
        thread.lastVisitedAt,
        localLastVisitedAtById[threadKey],
      ),
      wokeAt: threadWokeAt(thread, { now }),
    }).topStatus;
  // The sidebar's per-environment lookup: default instance ids collide across environments.
  const providerEntries = deriveProviderEntriesByEnvironment(
    [...serverConfigs].map(
      ([environmentId, config]) =>
        [environmentId, providersByEnvironment.get(environmentId) ?? [], config.settings] as const,
    ),
  );
  const providerOf = ({ thread }: CollapsedThreadTab) =>
    providerEntries
      .get(thread.environmentId)
      ?.get(thread.runtime?.providerInstanceId ?? thread.modelSelection.instanceId) ?? null;
  // Focusing the other pane replaces the route, as every pane-focus path does.
  // On Inlet a switch paints the chosen tab open first and navigates a frame later: the thread
  // view's render blocks for a while, and the tab answering at once is what makes the switch feel
  // immediate. Cleared as soon as the route moves, or once a navigation that went nowhere settles.
  const [pendingOpen, setPendingOpen] = useState<{
    readonly key: string;
    readonly from: string | null;
  } | null>(null);
  if (pendingOpen !== null && openThreadKey !== pendingOpen.from) setPendingOpen(null);
  const shownOpenKey = pendingOpen?.key ?? openThreadKey;
  const openThread = ({ thread, threadKey }: CollapsedThreadTab) => {
    clearSidebarSelection();
    const navigate = () =>
      router.navigate({
        to: "/$environmentId/$threadId",
        params: buildThreadRouteParams(scopeThreadRef(thread.environmentId, thread.id)),
        replace: paneThreadKeys.includes(threadKey),
      });
    if (!isInletActive()) {
      void navigate();
      return;
    }
    flushSync(() => setPendingOpen({ key: threadKey, from: openThreadKey }));
    window.requestAnimationFrame(() =>
      window.setTimeout(() => {
        void navigate().finally(() =>
          setPendingOpen((pending) => (pending?.key === threadKey ? null : pending)),
        );
      }, 0),
    );
  };
  // The sidebar's rule for cards, as source and target alike: never pinned or shelved.
  const splitPairable = ({ thread }: CollapsedThreadTab) =>
    thread.pinnedAt == null && !collapsedThreadShelved(thread, source);
  const splitPairableKeys = new Set(
    [...shownTabs, ...paneTabs.flatMap((pane) => (pane.kind === "thread" ? [pane.tab] : []))]
      .filter(splitPairable)
      .map((tab) => tab.threadKey),
  );
  const splitDropHandlers = makeSplitDropHandlers({
    canPair: (threadKey) => splitPairableKeys.has(threadKey),
    openThreadKey,
    openThread: (threadRef) => {
      clearSidebarSelection();
      void router.navigate({
        to: "/$environmentId/$threadId",
        params: buildThreadRouteParams(threadRef),
      });
    },
  });
  // Only a split's unfocused pane can hold a draft that is not the route's.
  const focusDraft = (draftId: DraftId) => {
    clearSidebarSelection();
    void router.navigate({ to: "/draft/$draftId", params: { draftId }, replace: true });
  };

  /** `segment`: one half of a split's tab, which wears the selected face for both. */
  const renderEntry = (entry: StripEntry, segment = false) => {
    if (entry.kind === "draft") {
      return (
        <DraftTab
          key={entry.threadKey}
          segment={segment}
          draftId={entry.draftId}
          defaultModelSelection={entry.defaultModelSelection}
          project={entry.project}
          providerOf={(instanceId) =>
            providerEntries.get(entry.environmentId)?.get(instanceId) ?? null
          }
          // Discarding leaves the route, so only the route's draft offers it; the other
          // pane's draft opens instead.
          {...(entry.draftId === openDraftId
            ? { routed: true, onDiscard: () => discardDraft(entry.draftId) }
            : { routed: false, onOpen: () => focusDraft(entry.draftId) })}
        />
      );
    }
    const { tab, project } = entry;
    return (
      <ThreadTab
        key={tab.threadKey}
        tab={tab}
        segment={segment}
        // A split's two tabs are both selected; only the focused one holds the route.
        active={tab.threadKey === shownOpenKey || paneThreadKeys.includes(tab.threadKey)}
        routed={tab.threadKey === openThreadKey}
        status={statusOf(tab)}
        provider={providerOf(tab)}
        project={project}
        pullRequestsInRightPanel={openThreadKey !== null}
        canSettle={
          serverConfigs.get(tab.thread.environmentId)?.environment.capabilities.threadSettlement ===
          true
        }
        splitDraggable={splitPairableKeys.has(tab.threadKey)}
        onOpen={() => openThread(tab)}
      />
    );
  };

  return (
    <div
      ref={forkThreadTabsRef}
      data-fork-thread-tabs=""
      className={cn(
        "drag-region flex h-[var(--workspace-topbar-height)] min-h-[var(--workspace-topbar-height)] shrink-0 items-center gap-3",
        // Clears the window controls and the floating sidebar toggle.
        "pl-[calc(var(--workspace-controls-left)+var(--workspace-titlebar-control-size)+var(--workspace-titlebar-control-gap))]",
        "pr-(--workspace-gutter-end) wco:pr-(--workspace-native-controls-inset)",
      )}
    >
      <SegmentedTabs
        aria-label="Filter threads by project"
        value={[projectKey]}
        onValueChange={(value) => {
          const next = value[0];
          if (typeof next !== "string") return;
          setStoredProjectKey(next);
          const openTab = shownTabs.find((tab) => tab.threadKey === openThreadKey);
          const target = collapsedFilterSwitchTarget({
            after: tabsIn(next),
            nextProjectKey: next,
            openProjectKeys:
              paneTabs.length > 0
                ? paneTabs.map((pane) =>
                    pane.kind === "thread" ? pane.tab.projectKey : pane.projectKey,
                  )
                : draftEntry !== null || openTab === undefined
                  ? null
                  : [openTab.projectKey],
          });
          if (target) openThread(target);
        }}
        // Scrolls sideways before it can squeeze out More.
        data-fork-tab-strip-projects=""
        className="min-w-0 shrink overflow-x-auto rounded-full [scrollbar-width:none]"
      >
        <ProjectTab value={ALL_PROJECTS} label="All projects">
          <LayersIcon className="size-3.5" />
        </ProjectTab>
        {projects.map((project) => (
          <ProjectTab
            key={project.projectKey}
            value={project.projectKey}
            label={project.displayName}
          >
            <ProjectFavicon project={project} className="size-3.5 shrink-0" />
          </ProjectTab>
        ))}
      </SegmentedTabs>
      <span className="flex shrink-0 items-center gap-1">
        <Menu>
          <Tooltip>
            <TooltipTrigger
              render={
                <MenuTrigger
                  render={
                    <button
                      type="button"
                      aria-label={STATUS_MENU_LABEL}
                      data-fork-tab-trigger=""
                      data-fork-tab-strip-control=""
                      className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-black/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset data-popup-open:bg-black/5 data-popup-open:text-foreground dark:hover:bg-white/8 dark:data-popup-open:bg-white/8"
                    />
                  }
                />
              }
            >
              <EllipsisIcon className="size-3.5" data-fork-tab-strip-icon="" />
            </TooltipTrigger>
            <TooltipPopup side="bottom">{STATUS_MENU_LABEL}</TooltipPopup>
          </Tooltip>
          <MenuPopup align="start" data-fork-tab-menu="" className="min-w-40">
            <MenuGroup>
              <MenuGroupLabel>Show as tabs</MenuGroupLabel>
              {COLLAPSED_TAB_STATUSES.map((status) => (
                <ScopeCheckboxItem
                  key={status}
                  checked={statuses.has(status)}
                  onCheckedChange={() => toggleStatus(status)}
                >
                  {SIDEBAR_V2_STATUS_SECTION_LABELS[status]}
                </ScopeCheckboxItem>
              ))}
            </MenuGroup>
          </MenuPopup>
        </Menu>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={newAgentLabel}
                disabled={projectGroups.length === 0}
                data-fork-tab-strip-control=""
                className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-black/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-64 dark:hover:bg-white/8"
                onClick={startNewAgent}
              />
            }
          >
            <PlusIcon className="size-3.5" data-fork-tab-strip-icon="" />
          </TooltipTrigger>
          <TooltipPopup side="bottom">
            {filteredProject === null && newAgentShortcutLabel
              ? `${newAgentLabel} (${newAgentShortcutLabel})`
              : newAgentLabel}
          </TooltipPopup>
        </Tooltip>
      </span>
      {/* px-1 and py-1 keep the selected tab's glass halo inside the clip. */}
      <nav
        ref={measureNav}
        aria-label="Active threads"
        // The min width keeps More (72px) and the halo padding on screen.
        className="-mx-1 -my-1 flex min-w-[80px] flex-1 items-center gap-1.5 overflow-hidden px-1 py-1"
        {...splitDropHandlers}
      >
        {row.slots.length === 0 && row.overflow.length === 0 ? (
          <span className="px-1 text-xs text-muted-foreground">
            {statuses.size === 0 ? "No statuses selected" : "No active threads"}
          </span>
        ) : null}
        {row.slots.map((slot) =>
          slot.kind === "tab" ? (
            renderEntry(slot.entry)
          ) : (
            // One selected tab naming both panes: each half keeps its own mark, title,
            // actions and click, but the face is the pair's.
            <div
              key="split-group"
              data-fork-split-tab-group=""
              data-fork-thread-tab=""
              data-active="true"
              className={SPLIT_TAB_CLASS}
              style={{ minWidth: slot.entries.length * COLLAPSED_TAB_MIN_WIDTH }}
            >
              {slot.entries.flatMap((entry, index) => [
                ...(index === 0
                  ? []
                  : [
                      // -mr-px: no width of its own, so the halves' minimum still fits.
                      <span
                        key={`divider:${entry.threadKey}`}
                        aria-hidden
                        data-fork-split-tab-divider=""
                        className="pointer-events-none -mr-px h-3.5 w-px shrink-0 bg-current opacity-20"
                      />,
                    ]),
                renderEntry(entry, true),
              ])}
            </div>
          ),
        )}
        {row.overflow.length === 0 ? null : (
          <Menu>
            <MenuTrigger
              render={
                <button
                  type="button"
                  aria-label={`${row.overflow.length} more active threads`}
                  data-fork-tab-trigger=""
                  data-fork-tab-strip-control=""
                  className="flex h-7 w-[72px] shrink-0 cursor-pointer items-center justify-center gap-1 rounded-full text-xs font-medium text-muted-foreground outline-none hover:bg-black/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset data-popup-open:bg-black/5 data-popup-open:text-foreground dark:hover:bg-white/8 dark:data-popup-open:bg-white/8"
                />
              }
            >
              {row.overflow.length} more
              <ChevronDownIcon className="size-3" />
            </MenuTrigger>
            <MenuPopup align="end" data-fork-tab-menu="" className="max-w-72">
              {row.overflow.map((entry) =>
                entry.kind === "draft" ? (
                  // The route's draft has nowhere to go (its X is on the tab); the other pane's opens.
                  <MenuItem
                    key={entry.threadKey}
                    {...(entry.draftId === openDraftId
                      ? {}
                      : { onClick: () => focusDraft(entry.draftId) })}
                  >
                    <SidebarV2StatusMark status={null} seed={entry.threadKey} idle="draft" />
                    <DraftTitle draftId={entry.draftId} />
                  </MenuItem>
                ) : (
                  <MenuItem key={entry.tab.threadKey} onClick={() => openThread(entry.tab)}>
                    <SidebarV2StatusMark
                      status={statusOf(entry.tab)}
                      seed={entry.tab.threadKey}
                      idle="dot"
                    />
                    <span className="min-w-0 truncate">{entry.tab.thread.title}</span>
                  </MenuItem>
                ),
              )}
            </MenuPopup>
          </Menu>
        )}
      </nav>
    </div>
  );
}

function ThreadTab(props: {
  readonly tab: CollapsedThreadTab;
  /** Half of a split's tab: the pair's tab is the selected one, so this one paints no fill. */
  readonly segment: boolean;
  /** Selected: the route's thread, or either of a split's two. */
  readonly active: boolean;
  /** Holds the route, so the PR actions need not open it first. */
  readonly routed: boolean;
  readonly status: TabStatus;
  readonly provider: ProviderInstanceEntry | null;
  readonly project: ProjectFaviconProject | null;
  /** As the sidebar card does: with a thread open, a PR opens in the right panel. */
  readonly pullRequestsInRightPanel: boolean;
  readonly canSettle: boolean;
  readonly splitDraggable: boolean;
  readonly onOpen: () => void;
}) {
  const { thread, threadKey } = props.tab;
  const threadRef = scopeThreadRef(thread.environmentId, thread.id);
  // The sidebar card's PR badge: same resolution, same click routing.
  const openPrLink = useOpenPrLink();
  const supportsMultiplePullRequests = useSupportsMultiplePullRequests(thread.environmentId);
  const linkedPullRequest = useLinkedThreadPullRequest(
    thread.environmentId,
    thread.linkedPullRequest,
    true,
    thread.pullRequests,
    thread.branchPullRequest,
  );
  const pr = linkedPullRequest?.pr ?? null;
  const currentLinkedPr = supportsMultiplePullRequests
    ? resolveThreadCurrentPullRequestLink(thread.pullRequests)
    : null;
  const prBadge = supportsMultiplePullRequests
    ? resolveThreadPullRequestBadge(thread.pullRequests)
    : null;
  const openPullRequest = (event: MouseEvent<HTMLElement>, targetUrl?: string) => {
    const url = targetUrl ?? pr?.url ?? currentLinkedPr?.url;
    if (!url) return;
    const inRightPanel = targetUrl !== undefined || props.pullRequestsInRightPanel;
    if (openPrLink(event, url, inRightPanel ? threadRef : undefined) && inRightPanel) {
      if (!props.routed) props.onOpen();
    }
  };
  const openPullRequestList = () => {
    useRightPanelStore.getState().open(threadRef, "pull-requests");
    if (!props.routed) props.onOpen();
  };
  // A tab's menu is for its one thread, never a selection made in the sidebar.
  const openMenu = (position: { x: number; y: number }) => {
    clearSidebarSelection();
    openSidebarThreadMenu(threadRef, position);
  };
  return (
    <div
      data-fork-thread-tab=""
      data-active={props.active && !props.segment ? "true" : undefined}
      data-fork-split-tab-segment={props.segment ? "" : undefined}
      data-fork-tab-has-mark={props.provider ? "" : undefined}
      // Dragged onto another tab (or sidebar card), this thread opens beside it.
      {...splitThreadDragSourceProps(threadKey, props.splitDraggable)}
      className={cn(
        TAB_SHELL_CLASS,
        props.segment
          ? "text-foreground"
          : props.active
            ? ACTIVE_TAB_CLASS
            : "text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/8",
      )}
      style={TAB_SHELL_STYLE}
      onContextMenu={(event) => {
        event.preventDefault();
        openMenu({ x: event.clientX, y: event.clientY });
      }}
    >
      {/* Stretched under the content so the PR badge can be its own link: the content
          ignores the pointer, and every press but the badge's reaches this button. */}
      <button
        type="button"
        data-fork-split-drag-surface=""
        aria-current={props.routed ? "page" : undefined}
        className="absolute inset-0 cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        onClick={props.onOpen}
      >
        <span className="sr-only">{thread.title}</span>
      </button>
      <span
        data-fork-tab-content=""
        className="pointer-events-none flex h-full min-w-0 flex-1 items-center gap-1.5 px-2.5"
      >
        {/* The hover actions cover the end of the mark and title, which fade under them
            rather than sliding them in, so no tab moves and the PR badge and status stay
            clickable. On a minimum-width tab they reach over the mark. */}
        <span className="relative flex h-full min-w-0 flex-1 items-center">
          {/* Stretched and pulled 4px into the padding so the hover mask, and the clip that
              keeps the marks off the PR badge on a minimum-width tab, spare the disc's shadow. */}
          <span className="-ml-1 flex min-w-0 flex-1 items-center gap-1.5 self-stretch overflow-hidden pl-1 group-focus-within/tab:[mask-image:linear-gradient(to_right,#000_calc(100%-3.5rem),#0000_calc(100%-2.75rem))] group-hover/tab:[mask-image:linear-gradient(to_right,#000_calc(100%-3.5rem),#0000_calc(100%-2.75rem))]">
            {/* The model picker's marks: the Claude Code mascot, the Codex cloud. */}
            {props.provider ? <TabProviderMark entry={props.provider} /> : null}
            {props.project ? <TabProjectMark project={props.project} /> : null}
            <span aria-hidden className="min-w-0 flex-1 truncate text-start">
              {thread.title}
            </span>
          </span>
          <span
            data-fork-tab-actions=""
            className="pointer-events-none absolute inset-y-0 right-0 flex items-center gap-0.5 opacity-0 group-focus-within/tab:pointer-events-auto group-focus-within/tab:opacity-100 group-hover/tab:pointer-events-auto group-hover/tab:opacity-100 [@media(any-hover:none)]:hidden"
          >
            {props.canSettle ? (
              <button
                type="button"
                aria-label="Settle thread"
                className={TAB_ACTION_CLASS}
                onClick={() => settleAndAdvance(threadRef)}
              >
                <CheckIcon className="size-3" />
              </button>
            ) : null}
            <button
              type="button"
              aria-label="More thread actions"
              aria-haspopup="menu"
              data-fork-tab-trigger=""
              data-fork-tab-actions-trigger=""
              className={TAB_ACTION_CLASS}
              onClick={(event) => openMenu(anchoredMenuPosition(event.currentTarget))}
            >
              <EllipsisIcon className="size-3.5" />
            </button>
          </span>
        </span>
        {prBadge?.kind === "stack" || pr || currentLinkedPr ? (
          <ThreadPullRequestBadgeControl
            render={
              <InlineButton
                className="pointer-events-auto relative flex items-center gap-1 [&>span]:text-[0.75rem] [&>span]:leading-4"
                data-fork-sidebar-pr-badge
              />
            }
            badge={prBadge}
            pullRequests={thread.pullRequests}
            number={pr?.number ?? currentLinkedPr?.number}
            url={pr?.url ?? currentLinkedPr?.url}
            status={prStatusIndicator(pr, linkedPullRequest?.sourceControlProvider)}
            onOpenList={openPullRequestList}
            onOpenPullRequest={openPullRequest}
          />
        ) : null}
        <SidebarV2StatusMark status={props.status} seed={threadKey} idle="dot" />
      </span>
    </div>
  );
}

/** A draft's tab: its prompt as the title (the sidebar's draft label), the composer's provider
    and the draft pencil. The route's draft has an X that discards it; a split's other pane's
    draft opens its pane instead. */
function DraftTab(
  props: {
    readonly draftId: DraftId;
    readonly defaultModelSelection: ModelSelection;
    readonly project: ProjectFaviconProject | null;
    readonly providerOf: (instanceId: string) => ProviderInstanceEntry | null;
    /** Half of a split's tab, as ThreadTab's. */
    readonly segment: boolean;
  } & (
    | { readonly routed: true; readonly onDiscard: () => void }
    | { readonly routed: false; readonly onOpen: () => void }
  ),
) {
  const instanceId = useComposerDraftStore(
    (store) =>
      sidebarDraftModelSelection({
        composerDraft: store.getComposerDraft(props.draftId),
        fallback: props.defaultModelSelection,
      }).instanceId,
  );
  const provider = props.providerOf(instanceId);
  return (
    <div
      data-fork-thread-tab=""
      data-active={props.segment ? undefined : "true"}
      data-fork-split-tab-segment={props.segment ? "" : undefined}
      data-fork-tab-has-mark={provider ? "" : undefined}
      className={cn(TAB_SHELL_CLASS, props.segment ? "text-foreground" : ACTIVE_TAB_CLASS)}
      style={TAB_SHELL_STYLE}
    >
      {props.routed ? null : (
        <button
          type="button"
          className="absolute inset-0 cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          onClick={props.onOpen}
        >
          <span className="sr-only">
            <DraftTitle draftId={props.draftId} />
          </span>
        </button>
      )}
      <span
        data-fork-tab-content=""
        aria-current={props.routed ? "page" : undefined}
        aria-hidden={props.routed ? undefined : true}
        className="pointer-events-none flex h-full min-w-0 flex-1 items-center gap-1.5 px-2.5"
      >
        {provider ? <TabProviderMark entry={provider} /> : null}
        {props.project ? <TabProjectMark project={props.project} /> : null}
        {/* Fades out under the discard button rather than sliding it in, so no tab moves. */}
        <span className="flex min-w-0 flex-1 items-center gap-1.5 group-focus-within/tab:[mask-image:linear-gradient(to_right,#000_calc(100%-2rem),#0000_calc(100%-1.25rem))] group-hover/tab:[mask-image:linear-gradient(to_right,#000_calc(100%-2rem),#0000_calc(100%-1.25rem))]">
          <DraftTitle draftId={props.draftId} />
          <SidebarV2StatusMark status={null} seed={props.draftId} idle="draft" />
        </span>
      </span>
      {props.routed ? (
        <span className="pointer-events-none absolute inset-y-0 right-1 flex items-center opacity-0 group-focus-within/tab:pointer-events-auto group-focus-within/tab:opacity-100 group-hover/tab:pointer-events-auto group-hover/tab:opacity-100 [@media(any-hover:none)]:pointer-events-auto [@media(any-hover:none)]:opacity-100">
          <button
            type="button"
            aria-label="Discard draft"
            className={TAB_ACTION_CLASS}
            onClick={props.onDiscard}
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ) : null}
    </div>
  );
}

/** Glass seats the mark on a disc of its provider's colour (theme.custom.glass-surfaces.css). */
function TabProviderMark(props: { readonly entry: ProviderInstanceEntry }) {
  const ink = FORK_MARK_INK_BY_DRIVER[props.entry.driverKind];
  return (
    <span
      data-fork-tab-provider-mark={ink ? "branded" : ""}
      style={ink ? ({ "--fork-tab-mark-brand": ink } as CSSProperties) : undefined}
      className="flex shrink-0 items-center justify-center"
    >
      <ModelPickerProviderGlyph entry={props.entry} showBadge={false} />
    </span>
  );
}

function TabProjectMark(props: { readonly project: ProjectFaviconProject }) {
  return <ProjectFavicon project={props.project} className="size-3.5 shrink-0" />;
}

/** The sidebar's draft label: the prompt with attachment chips read as their labels. */
function DraftTitle(props: { readonly draftId: DraftId }) {
  const title = useComposerDraftStore((store) =>
    sidebarDraftTitleFromPrompt(
      replaceComposerContextReferences(
        store.getComposerDraft(props.draftId)?.prompt ?? "",
        (occurrence) => occurrence.label,
      ),
    ),
  );
  return <span className="min-w-0 flex-1 truncate text-start">{title}</span>;
}

function ProjectTab(props: {
  readonly value: string;
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <SegmentedTab
            value={props.value}
            aria-label={props.label}
            data-fork-tab-strip-control=""
            className="w-7 rounded-full px-0"
          />
        }
      >
        {props.children}
      </TooltipTrigger>
      <TooltipPopup side="bottom">{props.label}</TooltipPopup>
    </Tooltip>
  );
}
