/**
 * A bot's Threads panel — see `.fork/customizations.yaml#fork-bot-work-threads`. Its own column in
 * the stage, between the conversation and the right panel, drawn by the right panel's own shell
 * (PreviewPanelShell: divider, resize handle, remembered width, open and close) and a sheet where
 * the right panel is one. It lists the bot's work in the sidebar's status sections.
 */
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { resolveThreadCurrentPullRequestLink } from "@t3tools/client-runtime/thread-pull-requests";
import type { ScopedThreadRef } from "@t3tools/contracts";
import type { PanelAnimationDurationMs } from "@t3tools/contracts/settings";
import { useNavigate } from "@tanstack/react-router";
import { XIcon } from "lucide-react";
import { useState } from "react";

import { PreviewPanelShell } from "~/components/preview/PreviewPanelShell";
import { PullRequestGlyph } from "~/components/pullRequest/pullRequestIcons";
import { RightPanelSheet } from "~/components/RightPanelSheet";
import { resolveThreadLastVisitedAt } from "~/components/Sidebar.logic";
import { Button } from "~/components/ui/button";
import { isElectron } from "~/env";
import { useNowMinute } from "~/hooks/useNowMinute";
import { usePreviewPanelInlineSize } from "~/hooks/usePreviewPanelInlineSize";
import { cn } from "~/lib/utils";
import { usePanelPresence } from "~/panelAnimations";
import { useQuietThreadShells } from "~/state/entities";
import { buildThreadRouteParams } from "~/threadRoutes";
import { formatRelativeTimeLabel } from "~/timestampFormat";
import { useUiStateStore } from "~/uiStateStore";

import { SidebarV2SectionLabel } from "../SidebarV2SectionLabel";
import { SidebarV2StatusMark } from "../SidebarV2StatusIndicator";
import { type BotWorkGroupKey, type BotWorkRow, groupBotWork } from "./botWork";
import { closeBotThreadsPanel, useBotThreadsPanelStore } from "./botThreadsPanelStore";

/** The right panel's own minimum, so the two panels open at the same width. */
const BOT_THREADS_PANEL_DEFAULT_WIDTH = 360;

export function BotThreadsPanel(props: {
  readonly threadRef: ScopedThreadRef;
  readonly workspaceLayoutElement: HTMLElement | null;
  /** Where the right panel is a sheet, this is one too. */
  readonly sheet: boolean;
  /** Held closed without forgetting it is open: a maximized right panel, a floating pane, or
      the right panel holding the one sheet slot. */
  readonly held: boolean;
  /** Nothing to its right, so it keeps clear of native window controls. */
  readonly rightmost: boolean;
  readonly animationsActive: boolean;
  readonly animationDurationMs: PanelAnimationDurationMs;
}) {
  const threadKey = scopedThreadKey(props.threadRef);
  const open =
    useBotThreadsPanelStore((state) => state.openByThreadKey[threadKey] === true) && !props.held;
  const presence = usePanelPresence(
    open,
    threadKey,
    props.animationsActive,
    threadKey,
    props.animationDurationMs,
  );
  const inlineSize = usePreviewPanelInlineSize({
    container: props.workspaceLayoutElement,
    widthStorageKey: `t3code:fork:bot-threads-panel-width:${threadKey}`,
    defaultWidth: BOT_THREADS_PANEL_DEFAULT_WIDTH,
  });
  if (!presence.present) return null;
  const body = (
    <>
      <div
        className={cn(
          "flex h-[var(--workspace-topbar-height)] min-h-[var(--workspace-topbar-height)] shrink-0 items-center gap-2 border-b border-border pr-2 pl-3.5",
          isElectron && "drag-region",
          isElectron && props.rightmost && "wco:pr-(--workspace-native-controls-inset)",
        )}
        data-fork-bot-threads-header=""
      >
        <h2 className="min-w-0 flex-1 truncate text-sm font-normal text-foreground">Threads</h2>
        <span className="flex shrink-0 [-webkit-app-region:no-drag]">
          <Button
            aria-label="Close threads panel"
            onClick={() => closeBotThreadsPanel(props.threadRef)}
            size="icon-xs"
            variant="ghost"
          >
            <XIcon />
          </Button>
        </span>
      </div>
      <BotThreadsList botRef={props.threadRef} />
    </>
  );
  if (props.sheet) {
    return (
      <RightPanelSheet
        animationDurationMs={props.animationsActive ? props.animationDurationMs : 0}
        open={open}
        onClose={() => closeBotThreadsPanel(props.threadRef)}
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

function BotThreadsList(props: { readonly botRef: ScopedThreadRef }) {
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
                  <BotThreadsRow key={row.thread.id} row={row} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** What the thread needs from the owner, in words, where the group alone does not say it. */
function rowDetail(thread: EnvironmentThreadShell, row: BotWorkRow): string | null {
  switch (row.card.status) {
    case "approval":
      return "Needs your approval";
    case "input":
    case "request":
      return "Waiting for your reply";
    case "limited":
      return "Hit a usage limit";
    case "failed":
      return thread.source.lastError?.split("\n")[0]?.trim() || "The last run failed";
    default:
      return null;
  }
}

function BotThreadsRow(props: { readonly row: BotWorkRow }) {
  const { thread, card } = props.row;
  const navigate = useNavigate();
  const nowMinute = useNowMinute();
  const detail = rowDetail(thread, props.row);
  const pullRequest = resolveThreadCurrentPullRequestLink(thread.pullRequests);
  const time = formatRelativeTimeLabel(
    thread.latestUserMessageAt ?? thread.updatedAt,
    Date.parse(`${nowMinute}:00.000Z`),
  ).replace(/ ago$/, "");
  const ref = scopeThreadRef(thread.environmentId, thread.id);
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          void navigate({ to: "/$environmentId/$threadId", params: buildThreadRouteParams(ref) });
        }}
        className="flex w-full cursor-pointer items-start gap-2.5 rounded-md px-1.5 py-1.5 text-left hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        data-testid="bot-threads-row"
      >
        <span className="flex h-5 w-3 shrink-0 items-center justify-center">
          {/* A static mark: the panel never paints the working animation. */}
          <SidebarV2StatusMark
            status={card.topStatus}
            seed={scopedThreadKey(ref)}
            idle="dot"
            workingMark={false}
          />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm leading-5 text-foreground">{thread.title}</span>
          {detail === null ? null : (
            <span className="truncate text-xs leading-4 text-muted-foreground">{detail}</span>
          )}
          {pullRequest === null ? null : (
            <span className="flex items-center gap-1 text-xs leading-4 text-muted-foreground">
              <PullRequestGlyph.pullRequest aria-hidden className="size-3 shrink-0" />#
              {pullRequest.number}
            </span>
          )}
        </span>
        <span className="shrink-0 text-xs leading-5 text-muted-foreground tabular-nums">
          {time}
        </span>
      </button>
    </li>
  );
}
