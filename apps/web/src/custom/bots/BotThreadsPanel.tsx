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
import { cn } from "~/lib/utils";
import { usePanelPresence } from "~/panelAnimations";
import { useQuietThreadShells } from "~/state/entities";
import { buildThreadRouteParams } from "~/threadRoutes";
import { formatRelativeTimeLabel } from "~/timestampFormat";
import { useUiStateStore } from "~/uiStateStore";

import { SidebarV2SectionLabel } from "../SidebarV2SectionLabel";
import { SidebarV2StatusMark } from "../SidebarV2StatusIndicator";
import { SidebarV2CheckoutMark } from "../SidebarV2ThreadCardMeta";
import { threadRowOpenSurfaceClassName } from "../sidebarV2RowPolicy";
import { StagePanelCloseButton } from "../stageColumns/StagePanelCloseButton";
import { type BotWorkGroupKey, type BotWorkRow, groupBotWork } from "./botWork";
import { closeBotThreadsPanel } from "./botThreadsPanelStore";
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
    <>
      <div
        className={cn(
          "flex h-[var(--workspace-topbar-height)] min-h-[var(--workspace-topbar-height)] shrink-0 items-center gap-2 border-b border-border pl-3.5",
          "pr-2",
          isElectron && "drag-region",
          isElectron && rightmost && "wco:pr-(--workspace-native-controls-inset)",
        )}
        data-fork-bot-threads-header=""
        // BOT_THREADS_PANEL_BOT_ATTRIBUTE and BOT_THREADS_PANEL_THREAD_ATTRIBUTE (the store reads them).
        data-fork-bot-threads-bot={botKey}
        data-fork-bot-threads-thread={scopedThreadKey(props.threadRef)}
      >
        <h2 className="min-w-0 flex-1 truncate text-sm font-normal text-foreground">Threads</h2>
        <span className="flex shrink-0 [-webkit-app-region:no-drag]">
          <StagePanelCloseButton
            label="Close threads panel"
            onClose={() => closeBotThreadsPanel(props.botRef)}
          />
        </span>
      </div>
      <BotThreadsList botRef={props.botRef} currentThreadRef={props.threadRef} />
    </>
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

function BotThreadsList(props: {
  readonly botRef: ScopedThreadRef;
  readonly currentThreadRef: ScopedThreadRef;
}) {
  const threads = useQuietThreadShells();
  const localVisits = useUiStateStore((state) => state.threadLastVisitedAtById);
  const [folded, setFolded] = useState<ReadonlySet<BotWorkGroupKey>>(() => new Set());
  const groups = groupBotWork(
    threads,
    { environmentId: props.botRef.environmentId, threadId: props.botRef.threadId },
    (thread) =>
      resolveThreadLastVisitedAt(
        thread.lastVisitedAt,
        localVisits[scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id))],
      ),
  );
  if (groups.length === 0) {
    return (
      <p className="px-3.5 py-3 text-sm text-muted-foreground">
        This bot has not started any threads.
      </p>
    );
  }
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
                onToggle={() =>
                  setFolded((previous) => {
                    const next = new Set(previous);
                    if (!next.delete(group.key)) next.add(group.key);
                    return next;
                  })
                }
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
