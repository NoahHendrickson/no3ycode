/**
 * A bot's Threads panel — see `.fork/customizations.yaml#fork-bot-work-threads`: a stage column
 * between the conversation and the right panel, in the right panel's shell (a sheet where that is
 * one), on the bot's conversation and on each of its threads, listing its work by status.
 */
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import type { PanelAnimationDurationMs } from "@t3tools/contracts/settings";
import { useNavigate } from "@tanstack/react-router";
import { type ComponentProps, type MouseEvent, useState, useSyncExternalStore } from "react";

import { PreviewPanelShell } from "~/components/preview/PreviewPanelShell";
import { RightPanelSheet } from "~/components/RightPanelSheet";
import { resolveThreadLastVisitedAt } from "~/components/Sidebar.logic";
import { isElectron } from "~/env";
import { useNowMinute } from "~/hooks/useNowMinute";
import { usePreviewPanelInlineSize } from "~/hooks/usePreviewPanelInlineSize";
import { observeResize } from "~/lib/observeResize";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { usePanelPresence } from "~/panelAnimations";
import type { SideChatParentPanel } from "~/lib/sideChatPane";
import { useProjects, useQuietThreadShell, useQuietThreadShells } from "~/state/entities";
import { buildThreadRouteParams } from "~/threadRoutes";
import { formatRelativeTimeLabel } from "~/timestampFormat";
import { useUiStateStore } from "~/uiStateStore";

import { ListItem } from "../ListItem";
import { SidebarV2SectionLabel } from "../SidebarV2SectionLabel";
import { SidebarV2StatusMark } from "../SidebarV2StatusIndicator";
import { SidebarV2CheckoutMark } from "../SidebarV2ThreadCardMeta";
import { openSidebarThreadMenu } from "../sidebarActionsBridge";
import { StagePanelCloseButton } from "../stageColumns/StagePanelCloseButton";
import { botThreadPullRequest } from "@t3tools/client-runtime/fork-bot-digest-links";
import { BotPullRequestMark, useBotPullRequestState } from "./BotPullRequestMark";
import { BotThreadsPanelControls } from "./BotThreadsPanelControls";
import { type BotWorkGroupKey, type BotWorkRow, filterBotWork, groupBotWork } from "./botWork";
import {
  clearBotThreadsFilters,
  closeBotThreadsPanel,
  EMPTY_BOT_THREADS_VIEW,
  takeBotThreadsSearchFocus,
  updateBotThreadsView,
  useBotThreadsPanelStore,
  useBotThreadsViewStore,
} from "./botThreadsPanelStore";
import {
  BOT_THREADS_PANEL_DEFAULT_WIDTH,
  BOT_THREADS_PANEL_MIN_WIDTH,
  stageFitsBothPanels,
} from "./stagePanels";
import { useBotThreadsPanelOpen } from "./useBotWorkOwner";
import {
  closeSprintChild,
  openInSprintPanel,
  SPRINT_PANEL_DEFAULT_WIDTH,
  useSprintOpenChild,
  useSprintPanelTab,
} from "../sprints/sprintPanelState";
import { SprintPanelTabContent, SprintPanelTabStrip } from "../sprints/SprintPanelTabs";
import { SprintChildConversation } from "../sprints/SprintChildConversation";
import { ChevronLeftIcon } from "../icons/lucide-hugeicons";
import { useIsSprintThread } from "../sprints/useIsSprintThread";

/** Whether the stage row holds the conversation and both panels, kept current as it resizes. */
function useStageFitsBothPanels(row: HTMLElement | null): boolean {
  return useSyncExternalStore(
    (onChange) => (row === null ? () => {} : observeResize(row, onChange)),
    () => row === null || stageFitsBothPanels(row.clientWidth),
  );
}

export function BotThreadsPanel(props: {
  readonly botRef: ScopedThreadRef;
  /** The thread on screen: the bot's conversation, or one of its threads. */
  readonly threadRef: ScopedThreadRef;
  readonly workspaceLayoutElement: HTMLElement | null;
  /** Where the right panel is a sheet, this is one too. */
  readonly sheet: boolean;
  /** Held closed without forgetting it is open: a maximized right panel, a floating pane, or
      the right panel holding the one sheet slot. */
  readonly held: boolean;
  /** The right panel is open inline to its right; else this is the rightmost column. */
  readonly rightPanelInline: boolean;
  readonly animationsActive: boolean;
  readonly animationDurationMs: PanelAnimationDurationMs;
  /** The conversation's own panel, which a sprint's open thread borrows as a side chat does. */
  readonly parentPanel?: SideChatParentPanel | undefined;
}) {
  const botKey = scopedThreadKey(props.botRef);
  const fitsBoth = useStageFitsBothPanels(props.workspaceLayoutElement);
  // A row narrowed below both panels keeps the right panel; this one waits for room.
  const open =
    useBotThreadsPanelOpen(props.botRef) && !props.held && !(props.rightPanelInline && !fitsBoth);
  const presence = usePanelPresence(
    open,
    botKey,
    props.animationsActive,
    botKey,
    props.animationDurationMs,
  );
  const isSprint = useIsSprintThread(props.botRef);
  const inlineSize = usePreviewPanelInlineSize({
    container: props.workspaceLayoutElement,
    widthStorageKey: `t3code:fork:bot-threads-panel-width:${botKey}`,
    defaultWidth: isSprint ? SPRINT_PANEL_DEFAULT_WIDTH : BOT_THREADS_PANEL_DEFAULT_WIDTH,
    floorWidth: BOT_THREADS_PANEL_MIN_WIDTH,
    otherPanels: "minimum",
  });
  if (!presence.present) return null;
  // Rightmost inline, its header is the one under Windows' caption buttons.
  const rightmost = !props.sheet && !props.rightPanelInline;
  const body = (
    <BotThreadsBody
      botRef={props.botRef}
      currentThreadRef={props.threadRef}
      rightmost={rightmost}
      parentPanel={props.parentPanel}
    />
  );
  if (props.sheet) {
    return (
      <RightPanelSheet
        animationDurationMs={props.animationsActive ? props.animationDurationMs : 0}
        open={open}
        onClose={() => closeBotThreadsPanel(props.botRef)}
      >
        <PreviewPanelShell mode="sheet">{body}</PreviewPanelShell>
      </RightPanelSheet>
    );
  }
  return (
    <PreviewPanelShell mode="inline" open={open} inlineSize={inlineSize}>
      {body}
    </PreviewPanelShell>
  );
}

/** The panel's header and its list, which read the same search, filter and order. */
function BotThreadsBody(props: {
  readonly botRef: ScopedThreadRef;
  readonly currentThreadRef: ScopedThreadRef;
  /** Its header is the one under Windows' caption buttons. */
  readonly rightmost: boolean;
  readonly parentPanel?: SideChatParentPanel | undefined;
}) {
  const botKey = scopedThreadKey(props.botRef);
  const threads = useQuietThreadShells();
  const projects = useProjects();
  const localVisits = useUiStateStore((state) => state.threadLastVisitedAtById);
  const sort = useBotThreadsPanelStore((state) => state.sort);
  const view = useBotThreadsViewStore((state) => state.byBotKey[botKey]) ?? EMPTY_BOT_THREADS_VIEW;
  const [folded, setFolded] = useState<ReadonlySet<BotWorkGroupKey>>(() => new Set());
  const all = groupBotWork(
    threads,
    { environmentId: props.botRef.environmentId, threadId: props.botRef.threadId },
    (thread) =>
      resolveThreadLastVisitedAt(
        thread.lastVisitedAt,
        localVisits[scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id))],
      ),
    sort,
  );
  const groups = filterBotWork(all, { ...view, query: view.query ?? "" });
  const isSprint = useIsSprintThread(props.botRef);
  // A sprint's panel has tabs; a Petal's is its Threads list alone.
  const sprintTab = useSprintPanelTab(botKey);
  const tab = isSprint ? sprintTab : "threads";
  const searching = tab === "threads" && view.query !== null;
  // A sprint shows the thread opened from it here, with a way back to its tabs.
  const openChild = useSprintOpenChild(botKey);
  const child = isSprint && props.parentPanel !== undefined ? openChild : null;
  const childShell = useQuietThreadShell(child);
  const projectIds = new Set(all.flatMap((group) => group.rows.map((row) => row.thread.projectId)));
  const searchInput = (
    <>
      <h2 className="sr-only">Threads</h2>
      <input
        aria-label="Search threads"
        className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none [-webkit-app-region:no-drag] placeholder:text-muted-foreground"
        data-testid="bot-threads-search-input"
        onChange={(event) => updateBotThreadsView(botKey, { query: event.target.value })}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.stopPropagation();
          updateBotThreadsView(botKey, { query: null });
        }}
        placeholder="Search threads"
        ref={(field) => {
          if (field !== null && takeBotThreadsSearchFocus()) field.focus();
        }}
        type="text"
        value={view.query ?? ""}
      />
    </>
  );
  const controls = (
    <BotThreadsPanelControls
      botKey={botKey}
      view={view}
      projects={projects
        .filter(
          (project) =>
            project.environmentId === props.botRef.environmentId && projectIds.has(project.id),
        )
        .map((project) => ({ id: project.id, title: project.title }))}
    />
  );
  const header = (
    <div
      className={cn(
        "flex h-(--workspace-topbar-height) min-h-(--workspace-topbar-height) shrink-0 items-center border-b border-border",
        // A sprint's tabs need the room: its track's own fill stands in for the inset.
        isSprint ? "gap-1 pr-0.5 pl-1.5" : "gap-2 pr-2 pl-3.5",
        isElectron && "drag-region",
        isElectron && props.rightmost && "wco:pr-(--workspace-native-controls-inset)",
      )}
      data-fork-bot-threads-header=""
      // BOT_THREADS_PANEL_BOT_ATTRIBUTE and BOT_THREADS_PANEL_THREAD_ATTRIBUTE (the store reads them).
      data-fork-bot-threads-bot={botKey}
      data-fork-bot-threads-thread={scopedThreadKey(props.currentThreadRef)}
    >
      {child !== null ? (
        <span className="flex min-w-0 flex-1 items-center gap-1 [-webkit-app-region:no-drag]">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Back to the sprint's threads"
            onClick={() => closeSprintChild(botKey)}
            data-testid="sprint-child-back"
          >
            <ChevronLeftIcon />
          </Button>
          <h2 className="min-w-0 flex-1 truncate text-sm font-normal text-foreground">
            {childShell?.title ?? "Thread"}
          </h2>
        </span>
      ) : isSprint && !searching ? (
        // A sprint's tabs stand in for the title; the open one names the panel.
        <SprintPanelTabStrip sprintKey={botKey} tab={tab} />
      ) : searching ? (
        searchInput
      ) : (
        <h2 className="min-w-0 flex-1 truncate text-sm font-normal text-foreground">Threads</h2>
      )}
      <span className="flex shrink-0 items-center [-webkit-app-region:no-drag]">
        {tab === "threads" && child === null ? controls : null}
        <StagePanelCloseButton
          label="Close threads panel"
          onClose={() => closeBotThreadsPanel(props.botRef)}
        />
      </span>
    </div>
  );
  const content =
    groups.length > 0 ? (
      <BotThreadsList
        groups={groups}
        folded={folded}
        compact={isSprint}
        onOpenThread={isSprint ? (ref) => openInSprintPanel(props.botRef, ref) : undefined}
        onToggle={(key) =>
          setFolded((previous) => {
            const next = new Set(previous);
            if (!next.delete(key)) next.add(key);
            return next;
          })
        }
        currentThreadRef={props.currentThreadRef}
      />
    ) : all.length === 0 ? (
      <p className="px-3.5 py-3 text-sm text-muted-foreground">
        {isSprint
          ? "This sprint has not started any threads."
          : "This petal has not started any threads."}
      </p>
    ) : (
      <div className="flex flex-col items-start gap-2 px-3.5 py-3">
        <p className="text-sm text-muted-foreground">No threads match.</p>
        <Button
          onClick={() => {
            clearBotThreadsFilters(botKey);
            if (view.query !== null) updateBotThreadsView(botKey, { query: "" });
          }}
          size="xs"
          variant="outline"
        >
          Clear search and filters
        </Button>
      </div>
    );
  return (
    <>
      {header}
      {child !== null && props.parentPanel !== undefined ? (
        <SprintChildConversation
          sprintRef={props.botRef}
          childRef={child}
          parentPanel={props.parentPanel}
        />
      ) : tab === "threads" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">{content}</div>
      ) : (
        <SprintPanelTabContent sprintRef={props.botRef} tab={tab} />
      )}
    </>
  );
}

function BotThreadsList(props: {
  readonly groups: ReturnType<typeof filterBotWork>;
  readonly folded: ReadonlySet<BotWorkGroupKey>;
  readonly onToggle: (key: BotWorkGroupKey) => void;
  readonly currentThreadRef: ScopedThreadRef;
  readonly compact: boolean;
  readonly onOpenThread?: ((ref: ScopedThreadRef) => void) | undefined;
}) {
  const { groups, folded } = props;
  return (
    <div className="px-2 pb-3">
      {groups.map((group) => {
        const collapsed = folded.has(group.key);
        return (
          <section key={group.key} className="pt-3">
            <div className={cn("flex h-7 items-center", props.compact ? "px-2.5" : "px-1.5")}>
              <SidebarV2SectionLabel
                collapsed={collapsed}
                onToggle={() => props.onToggle(group.key)}
                testId={`bot-threads-group-${group.key}`}
                size={props.compact ? "interface" : "sidebar"}
              >
                {group.label}
              </SidebarV2SectionLabel>
            </div>
            {collapsed ? null : (
              <ul className="flex flex-col gap-0.5">
                {group.rows.map((row) => (
                  <BotThreadsRow
                    key={row.thread.id}
                    row={row}
                    compact={props.compact}
                    onOpenThread={props.onOpenThread}
                    current={
                      row.thread.id === props.currentThreadRef.threadId &&
                      row.thread.environmentId === props.currentThreadRef.environmentId
                    }
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** Status mark and title, then which checkout the thread is on and its pull request. The
    project is left out: a bot's threads are read under the bot, which already places them. */
function BotThreadsRow(props: {
  readonly row: BotWorkRow;
  readonly current: boolean;
  readonly compact: boolean;
  /** Opens the thread somewhere other than the main column: a sprint's own panel. */
  readonly onOpenThread?: ((ref: ScopedThreadRef) => void) | undefined;
}) {
  const { thread, card } = props.row;
  const navigate = useNavigate();
  const nowMinute = useNowMinute();
  const pullRequest = botThreadPullRequest(thread);
  const { state: pullRequestState } = useBotPullRequestState(pullRequest, thread.environmentId);
  const time = formatRelativeTimeLabel(
    thread.latestUserMessageAt ?? thread.updatedAt,
    Date.parse(`${nowMinute}:00.000Z`),
  ).replace(/ ago$/, "");
  const ref = scopeThreadRef(thread.environmentId, thread.id);
  return (
    <BotThreadsRowView
      status={card.topStatus}
      seed={scopedThreadKey(ref)}
      title={thread.title}
      time={time}
      pullRequest={
        pullRequest === null ? null : { number: pullRequest.number, state: pullRequestState }
      }
      branch={thread.branch}
      hasWorktree={thread.worktreePath !== null}
      current={props.current}
      compact={props.compact}
      onOpen={() => {
        if (props.onOpenThread !== undefined) {
          props.onOpenThread(ref);
          return;
        }
        if (props.current) return;
        void navigate({ to: "/$environmentId/$threadId", params: buildThreadRouteParams(ref) });
      }}
      // The thread's own menu, whose Petal submenu moves it to another bot or out of this one.
      onContextMenu={(event) => {
        event.preventDefault();
        openSidebarThreadMenu(ref, { x: event.clientX, y: event.clientY });
      }}
    />
  );
}

/** @public — the row as drawn, from plain props; Storybook renders it on its own. */
export function BotThreadsRowView(props: {
  readonly status: ComponentProps<typeof SidebarV2StatusMark>["status"];
  readonly seed: string;
  readonly title: string;
  /** Relative time without " ago", as the row shows it. */
  readonly time: string;
  readonly pullRequest: ComponentProps<typeof BotPullRequestMark> | null;
  readonly branch: string | null;
  readonly hasWorktree: boolean;
  readonly current: boolean;
  /** One line: a sprint's list, which leaves the checkout to the thread. */
  readonly compact?: boolean;
  readonly onOpen: () => void;
  readonly onContextMenu?: ((event: MouseEvent<HTMLButtonElement>) => void) | undefined;
}) {
  return (
    <li>
      <ListItem
        aria-current={props.current ? "page" : undefined}
        onClick={props.onOpen}
        onContextMenu={props.onContextMenu}
        className={cn(
          "gap-2.5 py-1.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          props.compact === true ? "items-center px-2.5" : "items-start px-1.5",
          props.current && "bg-accent",
        )}
        data-testid="bot-threads-row"
      >
        <span className="flex h-5 w-3 shrink-0 items-center justify-center">
          <SidebarV2StatusMark status={props.status} seed={props.seed} idle="dot" />
        </span>
        {props.compact === true ? (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-base leading-5 text-foreground">
              {props.title}
            </span>
            {props.pullRequest === null ? null : (
              <span className="shrink-0 text-xs text-muted-foreground">
                <BotPullRequestMark
                  number={props.pullRequest.number}
                  state={props.pullRequest.state}
                />
              </span>
            )}
            <span className="shrink-0 text-xs leading-5 text-muted-foreground tabular-nums">
              {props.time}
            </span>
          </span>
        ) : (
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm leading-5 text-foreground">
                {props.title}
              </span>
              <span className="shrink-0 text-xs leading-5 text-muted-foreground tabular-nums">
                {props.time}
              </span>
            </span>
            {/* Always drawn, so every row is the same height with or without a branch. */}
            <span className="flex h-4 min-w-0 items-center gap-3 text-xs leading-4 text-muted-foreground">
              {props.pullRequest === null ? null : (
                <BotPullRequestMark
                  number={props.pullRequest.number}
                  state={props.pullRequest.state}
                />
              )}
              {props.branch !== null || props.hasWorktree ? (
                <SidebarV2CheckoutMark
                  branch={props.branch}
                  hasWorktree={props.hasWorktree}
                  devServerPort={null}
                  className="flex min-w-0 items-center gap-0.5"
                />
              ) : null}
            </span>
          </span>
        )}
      </ListItem>
    </li>
  );
}
