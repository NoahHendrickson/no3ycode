/**
 * A bot's Threads panel — see `.fork/customizations.yaml#fork-bot-work-threads`: a stage column
 * between the conversation and the right panel, in the right panel's shell (a sheet where that is
 * one), on the bot's conversation and on each of its threads, listing its work by status.
 */
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { resolveThreadCurrentPullRequestLink } from "@t3tools/client-runtime/thread-pull-requests";
import type { ScopedThreadRef } from "@t3tools/contracts";
import type { PanelAnimationDurationMs } from "@t3tools/contracts/settings";
import { useNavigate } from "@tanstack/react-router";
import { useState, useSyncExternalStore } from "react";

import { PreviewPanelShell } from "~/components/preview/PreviewPanelShell";
import { PullRequestGlyph } from "~/components/pullRequest/pullRequestIcons";
import { resolvePullRequestState } from "~/components/pullRequest/pullRequestPresentation";
import { RightPanelSheet } from "~/components/RightPanelSheet";
import { resolveThreadLastVisitedAt } from "~/components/Sidebar.logic";
import { isElectron } from "~/env";
import { useNowMinute } from "~/hooks/useNowMinute";
import { usePreviewPanelInlineSize } from "~/hooks/usePreviewPanelInlineSize";
import { observeResize } from "~/lib/observeResize";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { usePanelPresence } from "~/panelAnimations";
import { useProjects, useQuietThreadShells } from "~/state/entities";
import { buildThreadRouteParams } from "~/threadRoutes";
import { formatRelativeTimeLabel } from "~/timestampFormat";
import { useUiStateStore } from "~/uiStateStore";

import { SidebarV2SectionLabel } from "../SidebarV2SectionLabel";
import { SidebarV2StatusMark } from "../SidebarV2StatusIndicator";
import { SidebarV2CheckoutMark } from "../SidebarV2ThreadCardMeta";
import { threadRowOpenSurfaceClassName } from "../sidebarV2RowPolicy";
import { StagePanelCloseButton } from "../stageColumns/StagePanelCloseButton";
import { BotThreadsPanelControls } from "./BotThreadsPanelControls";
import { type BotWorkGroupKey, type BotWorkRow, filterBotWork, groupBotWork } from "./botWork";
import {
  clearBotThreadsFilters,
  closeBotThreadsPanel,
  EMPTY_BOT_THREADS_VIEW,
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
  const inlineSize = usePreviewPanelInlineSize({
    container: props.workspaceLayoutElement,
    widthStorageKey: `t3code:fork:bot-threads-panel-width:${botKey}`,
    defaultWidth: BOT_THREADS_PANEL_DEFAULT_WIDTH,
    floorWidth: BOT_THREADS_PANEL_MIN_WIDTH,
  });
  if (!presence.present) return null;
  // Rightmost inline, its header is the one under Windows' caption buttons.
  const rightmost = !props.sheet && !props.rightPanelInline;
  const body = (
    <BotThreadsBody
      botRef={props.botRef}
      currentThreadRef={props.threadRef}
      rightmost={rightmost}
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
  const projectIds = new Set(all.flatMap((group) => group.rows.map((row) => row.thread.projectId)));
  const header = (
    <div
      className={cn(
        "flex h-[var(--workspace-topbar-height)] min-h-[var(--workspace-topbar-height)] shrink-0 items-center gap-2 border-b border-border pl-3.5",
        "pr-2",
        isElectron && "drag-region",
        isElectron && props.rightmost && "wco:pr-(--workspace-native-controls-inset)",
      )}
      data-fork-bot-threads-header=""
      // BOT_THREADS_PANEL_BOT_ATTRIBUTE and BOT_THREADS_PANEL_THREAD_ATTRIBUTE (the store reads them).
      data-fork-bot-threads-bot={botKey}
      data-fork-bot-threads-thread={scopedThreadKey(props.currentThreadRef)}
    >
      {view.query === null ? (
        <h2 className="min-w-0 flex-1 truncate text-sm font-normal text-foreground">Threads</h2>
      ) : (
        <>
          <h2 className="sr-only">Threads</h2>
          <input
            aria-label="Search threads"
            autoFocus
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none [-webkit-app-region:no-drag] placeholder:text-muted-foreground"
            data-testid="bot-threads-search-input"
            onChange={(event) => updateBotThreadsView(botKey, { query: event.target.value })}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.stopPropagation();
              updateBotThreadsView(botKey, { query: null });
            }}
            placeholder="Search threads"
            type="text"
            value={view.query}
          />
        </>
      )}
      <span className="flex shrink-0 items-center [-webkit-app-region:no-drag]">
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
        <StagePanelCloseButton
          label="Close threads panel"
          onClose={() => closeBotThreadsPanel(props.botRef)}
        />
      </span>
    </div>
  );
  if (groups.length === 0) {
    return (
      <>
        {header}
        {all.length === 0 ? (
          <p className="px-3.5 py-3 text-sm text-muted-foreground">
            This bot has not started any threads.
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
        )}
      </>
    );
  }
  return (
    <>
      {header}
      <BotThreadsList
        groups={groups}
        folded={folded}
        onToggle={(key) =>
          setFolded((previous) => {
            const next = new Set(previous);
            if (!next.delete(key)) next.add(key);
            return next;
          })
        }
        currentThreadRef={props.currentThreadRef}
      />
    </>
  );
}

function BotThreadsList(props: {
  readonly groups: ReturnType<typeof filterBotWork>;
  readonly folded: ReadonlySet<BotWorkGroupKey>;
  readonly onToggle: (key: BotWorkGroupKey) => void;
  readonly currentThreadRef: ScopedThreadRef;
}) {
  const { groups, folded } = props;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
      {groups.map((group) => {
        const collapsed = folded.has(group.key);
        return (
          <section key={group.key} className="pt-3">
            <div className="flex h-7 items-center px-1.5">
              <SidebarV2SectionLabel
                count={group.rows.length}
                collapsed={collapsed}
                onToggle={() => props.onToggle(group.key)}
                testId={`bot-threads-group-${group.key}`}
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
function BotThreadsRow(props: { readonly row: BotWorkRow; readonly current: boolean }) {
  const { thread, card } = props.row;
  const navigate = useNavigate();
  const nowMinute = useNowMinute();
  const pullRequest = resolveThreadCurrentPullRequestLink(thread.pullRequests);
  const pullRequestState =
    pullRequest?.snapshot == null ? null : resolvePullRequestState(pullRequest.snapshot);
  const PullRequestIcon = pullRequestState?.Icon ?? PullRequestGlyph.pullRequest;
  const time = formatRelativeTimeLabel(
    thread.latestUserMessageAt ?? thread.updatedAt,
    Date.parse(`${nowMinute}:00.000Z`),
  ).replace(/ ago$/, "");
  const ref = scopeThreadRef(thread.environmentId, thread.id);
  return (
    <li>
      <button
        type="button"
        aria-current={props.current ? "page" : undefined}
        onClick={() => {
          if (props.current) return;
          void navigate({ to: "/$environmentId/$threadId", params: buildThreadRouteParams(ref) });
        }}
        className={cn(
          "flex w-full cursor-pointer items-start gap-2.5 rounded-md px-1.5 py-1.5 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          // The sidebar's open row, so the thread on screen reads the same in both lists.
          props.current ? threadRowOpenSurfaceClassName("shelf") : "hover:bg-accent",
        )}
        data-testid="bot-threads-row"
      >
        <span className="flex h-5 w-3 shrink-0 items-center justify-center">
          <SidebarV2StatusMark status={card.topStatus} seed={scopedThreadKey(ref)} idle="dot" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm leading-5 text-foreground">
              {thread.title}
            </span>
            <span className="shrink-0 text-xs leading-5 text-muted-foreground tabular-nums">
              {time}
            </span>
          </span>
          {/* Always drawn, so every row is the same height with or without a branch. */}
          <span className="flex h-4 min-w-0 items-center gap-3 text-xs leading-4 text-muted-foreground">
            {thread.branch !== null || thread.worktreePath !== null ? (
              <SidebarV2CheckoutMark
                branch={thread.branch}
                hasWorktree={thread.worktreePath !== null}
                devServerPort={null}
                className="flex min-w-0 items-center gap-0.5"
              />
            ) : null}
            {pullRequest === null ? null : (
              <span
                className={cn("flex shrink-0 items-center gap-1", pullRequestState?.toneClassName)}
              >
                <PullRequestIcon aria-hidden className="size-3 shrink-0" />
                <span className="sr-only">
                  {pullRequestState === null
                    ? "Pull request"
                    : `${pullRequestState.label} pull request`}
                </span>
                {pullRequest.number}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}
