/**
 * A bot's Threads panel — see `.fork/customizations.yaml#fork-bot-work-threads`: a stage column
 * between the conversation and the right panel, in the right panel's shell (a sheet where that is
 * one), on the bot's conversation and on each of its threads, listing its work by status. The
 * frame, list, search and controls are shared with a sprint's panel (sprints/SprintPanel).
 */
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import type { PanelAnimationDurationMs } from "@t3tools/contracts/settings";
import { useNavigate } from "@tanstack/react-router";
import {
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
  useState,
  useSyncExternalStore,
} from "react";

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
import { useProjects, useQuietThreadShells } from "~/state/entities";
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
  type BotThreadsView,
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

/** Whether the stage row holds the conversation and both panels, kept current as it resizes. */
function useStageFitsBothPanels(row: HTMLElement | null): boolean {
  return useSyncExternalStore(
    (onChange) => (row === null ? () => {} : observeResize(row, onChange)),
    () => row === null || stageFitsBothPanels(row.clientWidth),
  );
}

export interface BotThreadsPanelProps {
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
}

/** Rightmost inline, the panel's header is the one under Windows' caption buttons. */
export function botThreadsPanelRightmost(props: BotThreadsPanelProps): boolean {
  return !props.sheet && !props.rightPanelInline;
}

/** The panel's column (or sheet), its motion and its width, around its header and body. */
export function BotThreadsPanelFrame(
  props: BotThreadsPanelProps & { readonly defaultWidth: number; readonly children: ReactNode },
) {
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
    defaultWidth: props.defaultWidth,
    floorWidth: BOT_THREADS_PANEL_MIN_WIDTH,
    otherPanels: "minimum",
  });
  if (!presence.present) return null;
  const body = props.children;
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

export function BotThreadsPanel(props: BotThreadsPanelProps) {
  return (
    <BotThreadsPanelFrame {...props} defaultWidth={BOT_THREADS_PANEL_DEFAULT_WIDTH}>
      <BotThreadsBody
        botRef={props.botRef}
        currentThreadRef={props.threadRef}
        rightmost={botThreadsPanelRightmost(props)}
      />
    </BotThreadsPanelFrame>
  );
}

/** The bot's work in its groups, by the panel's search, filter and order, and the fold of each. */
export function useBotThreadsListing(botRef: ScopedThreadRef) {
  const botKey = scopedThreadKey(botRef);
  const threads = useQuietThreadShells();
  const projects = useProjects();
  const localVisits = useUiStateStore((state) => state.threadLastVisitedAtById);
  const sort = useBotThreadsPanelStore((state) => state.sort);
  const view = useBotThreadsViewStore((state) => state.byBotKey[botKey]) ?? EMPTY_BOT_THREADS_VIEW;
  const [folded, setFolded] = useState<ReadonlySet<BotWorkGroupKey>>(() => new Set());
  const all = groupBotWork(
    threads,
    { environmentId: botRef.environmentId, threadId: botRef.threadId },
    (thread) =>
      resolveThreadLastVisitedAt(
        thread.lastVisitedAt,
        localVisits[scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id))],
      ),
    sort,
  );
  const projectIds = new Set(all.flatMap((group) => group.rows.map((row) => row.thread.projectId)));
  return {
    botKey,
    view,
    all,
    groups: filterBotWork(all, { ...view, query: view.query ?? "" }),
    folded,
    toggleFolded: (key: BotWorkGroupKey) =>
      setFolded((previous) => {
        const next = new Set(previous);
        if (!next.delete(key)) next.add(key);
        return next;
      }),
    /** The projects its work is in, for the filter. */
    projects: projects
      .filter(
        (project) => project.environmentId === botRef.environmentId && projectIds.has(project.id),
      )
      .map((project) => ({ id: project.id, title: project.title })),
  };
}

type BotThreadsListing = ReturnType<typeof useBotThreadsListing>;

/** The panel's header bar; the store reads which bot and thread it is on from its attributes. */
export function BotThreadsHeader(props: {
  readonly botKey: string;
  readonly currentThreadRef: ScopedThreadRef;
  readonly rightmost: boolean;
  /** Its gap and side insets. */
  readonly className: string;
  readonly children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex h-(--workspace-topbar-height) min-h-(--workspace-topbar-height) shrink-0 items-center border-b border-border",
        props.className,
        isElectron && "drag-region",
        isElectron && props.rightmost && "wco:pr-(--workspace-native-controls-inset)",
      )}
      data-fork-bot-threads-header=""
      // BOT_THREADS_PANEL_BOT_ATTRIBUTE and BOT_THREADS_PANEL_THREAD_ATTRIBUTE (the store reads them).
      data-fork-bot-threads-bot={props.botKey}
      data-fork-bot-threads-thread={scopedThreadKey(props.currentThreadRef)}
    >
      {props.children}
    </div>
  );
}

/** Search in place of the header's title, until Escape. */
export function BotThreadsSearchInput(props: {
  readonly botKey: string;
  readonly view: BotThreadsView;
}) {
  return (
    <>
      <h2 className="sr-only">Threads</h2>
      <input
        aria-label="Search threads"
        className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none [-webkit-app-region:no-drag] placeholder:text-muted-foreground"
        data-testid="bot-threads-search-input"
        onChange={(event) => updateBotThreadsView(props.botKey, { query: event.target.value })}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.stopPropagation();
          updateBotThreadsView(props.botKey, { query: null });
        }}
        placeholder="Search threads"
        ref={(field) => {
          if (field !== null && takeBotThreadsSearchFocus()) field.focus();
        }}
        type="text"
        value={props.view.query ?? ""}
      />
    </>
  );
}

/** Search, filter and order for the list. */
export function BotThreadsListControls(props: { readonly listing: BotThreadsListing }) {
  return (
    <BotThreadsPanelControls
      botKey={props.listing.botKey}
      view={props.listing.view}
      projects={props.listing.projects}
    />
  );
}

export function BotThreadsCloseButton(props: { readonly botRef: ScopedThreadRef }) {
  return (
    <StagePanelCloseButton
      label="Close threads panel"
      onClose={() => closeBotThreadsPanel(props.botRef)}
    />
  );
}

/** The list, or why it is empty: `none` when the bot started nothing, a way back when the
    search and filters hide everything. */
export function BotThreadsListBody(props: {
  readonly listing: BotThreadsListing;
  readonly none: string;
  readonly children: ReactNode;
}) {
  const { listing } = props;
  if (listing.groups.length > 0) return props.children;
  if (listing.all.length === 0) {
    return <p className="px-3.5 py-3 text-sm text-muted-foreground">{props.none}</p>;
  }
  return (
    <div className="flex flex-col items-start gap-2 px-3.5 py-3">
      <p className="text-sm text-muted-foreground">No threads match.</p>
      <Button
        onClick={() => {
          clearBotThreadsFilters(listing.botKey);
          if (listing.view.query !== null) updateBotThreadsView(listing.botKey, { query: "" });
        }}
        size="xs"
        variant="outline"
      >
        Clear search and filters
      </Button>
    </div>
  );
}

/** The panel's header and its list, which read the same search, filter and order. */
function BotThreadsBody(props: {
  readonly botRef: ScopedThreadRef;
  readonly currentThreadRef: ScopedThreadRef;
  /** Its header is the one under Windows' caption buttons. */
  readonly rightmost: boolean;
}) {
  const listing = useBotThreadsListing(props.botRef);
  const { botKey, view } = listing;
  return (
    <>
      <BotThreadsHeader
        botKey={botKey}
        currentThreadRef={props.currentThreadRef}
        rightmost={props.rightmost}
        className="gap-2 pr-2 pl-3.5"
      >
        {view.query === null ? (
          <h2 className="min-w-0 flex-1 truncate text-sm font-normal text-foreground">Threads</h2>
        ) : (
          <BotThreadsSearchInput botKey={botKey} view={view} />
        )}
        <span className="flex shrink-0 items-center [-webkit-app-region:no-drag]">
          <BotThreadsListControls listing={listing} />
          <BotThreadsCloseButton botRef={props.botRef} />
        </span>
      </BotThreadsHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <BotThreadsListBody listing={listing} none="This petal has not started any threads.">
          <BotThreadsList
            listing={listing}
            currentThreadRef={props.currentThreadRef}
            renderRow={(row, current) => (
              <BotThreadsRow key={row.thread.id} row={row} current={current} />
            )}
          />
        </BotThreadsListBody>
      </div>
    </>
  );
}

/** The groups, each a label that folds it and its rows. */
export function BotThreadsList(props: {
  readonly listing: BotThreadsListing;
  readonly currentThreadRef: ScopedThreadRef;
  /** Each row, keyed by its thread. */
  readonly renderRow: (row: BotWorkRow, current: boolean) => ReactNode;
  /** The labels' inset, to line up with the rows'. */
  readonly labelClassName?: string;
  readonly labelSize?: ComponentProps<typeof SidebarV2SectionLabel>["size"];
}) {
  const { groups, folded, toggleFolded } = props.listing;
  return (
    <div className="px-2 pb-3">
      {groups.map((group) => {
        const collapsed = folded.has(group.key);
        return (
          <section key={group.key} className="pt-3">
            <div className={cn("flex h-7 items-center", props.labelClassName ?? "px-1.5")}>
              <SidebarV2SectionLabel
                collapsed={collapsed}
                onToggle={() => toggleFolded(group.key)}
                testId={`bot-threads-group-${group.key}`}
                size={props.labelSize ?? "sidebar"}
              >
                {group.label}
              </SidebarV2SectionLabel>
            </div>
            {collapsed ? null : (
              <ul className="flex flex-col gap-0.5">
                {group.rows.map((row) =>
                  props.renderRow(
                    row,
                    row.thread.id === props.currentThreadRef.threadId &&
                      row.thread.environmentId === props.currentThreadRef.environmentId,
                  ),
                )}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** What a row shows and does, whichever layout draws it. `onOpenThread` opens the thread
    somewhere other than the main column (a sprint's own panel). */
export function useBotThreadsRow(
  row: BotWorkRow,
  current: boolean,
  onOpenThread?: (ref: ScopedThreadRef) => void,
) {
  const { thread, card } = row;
  const navigate = useNavigate();
  const nowMinute = useNowMinute();
  const pullRequest = botThreadPullRequest(thread);
  const {
    state: pullRequestState,
    chipState,
    checks,
  } = useBotPullRequestState(pullRequest, thread.environmentId);
  const time = formatRelativeTimeLabel(
    thread.latestUserMessageAt ?? thread.updatedAt,
    Date.parse(`${nowMinute}:00.000Z`),
  ).replace(/ ago$/, "");
  const ref = scopeThreadRef(thread.environmentId, thread.id);
  return {
    status: card.topStatus,
    seed: scopedThreadKey(ref),
    title: thread.title,
    time,
    pullRequest:
      pullRequest === null
        ? null
        : { number: pullRequest.number, state: pullRequestState, chipState, checks },
    branch: thread.branch,
    hasWorktree: thread.worktreePath !== null,
    current,
    onOpen: () => {
      if (onOpenThread !== undefined) {
        onOpenThread(ref);
        return;
      }
      if (current) return;
      void navigate({ to: "/$environmentId/$threadId", params: buildThreadRouteParams(ref) });
    },
    // The thread's own menu, whose Petal submenu moves it to another bot or out of this one.
    onContextMenu: (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      openSidebarThreadMenu(ref, { x: event.clientX, y: event.clientY });
    },
  };
}

/** Status mark and title, then which checkout the thread is on and its pull request. The
    project is left out: a bot's threads are read under the bot, which already places them. */
function BotThreadsRow(props: { readonly row: BotWorkRow; readonly current: boolean }) {
  return <BotThreadsRowView {...useBotThreadsRow(props.row, props.current)} />;
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
          "items-start gap-2.5 px-1.5 py-1.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          props.current && "bg-accent",
        )}
        data-testid="bot-threads-row"
      >
        <span className="flex h-5 w-3 shrink-0 items-center justify-center">
          <SidebarV2StatusMark status={props.status} seed={props.seed} idle="dot" />
        </span>
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
      </ListItem>
    </li>
  );
}
