/**
 * Threads in a conversation as a light tree — see `.fork/customizations.yaml#fork-thread-launch-cards`.
 * A reply's launches hang off it; a reply a report started opens with that thread's row. Rows read
 * the thread live and open it in a split beside this conversation.
 */
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ScopedThreadRef } from "@t3tools/contracts";
import { useRouter } from "@tanstack/react-router";
import { Fragment, type MouseEvent, type ReactNode, use } from "react";

import { TimelineRowCtx } from "~/components/chat/timelineRowContext";
import { resolveThreadLastVisitedAt } from "~/components/Sidebar.logic";
import { useOpenPrLink } from "~/lib/openPullRequestLink";
import { cn } from "~/lib/utils";
import { useQuietThreadShell, useQuietThreadShells } from "~/state/entities";
import { buildThreadRouteParams } from "~/threadRoutes";
import { useUiStateStore } from "~/uiStateStore";

import { GitMergeIcon, GitPullRequestIcon } from "../icons/lucide-hugeicons";
import { resolveSidebarV2CardStatus } from "../sidebarV2CardStatus";
import { SidebarV2StatusMark } from "../SidebarV2StatusIndicator";
import { morphSplitPairs } from "../splitThreads/splitMorph";
import { useSplitPane } from "../splitThreads/splitPaneContext";
import { useSplitThreadStore } from "../splitThreads/splitThreadStore";
import { openInSprintPanel } from "../sprints/sprintPanelState";
import { ForkAnsweredRequest, ForkThreadRequestCard } from "./ForkThreadRequestCard";
import {
  type ForkThreadLaunch,
  forkWorkReportIsPending,
  forkWorkReportKey,
  forkWorkReportRequestKind,
  forkWorkReportThreadId,
  THREAD_PULL_REQUEST_STAGE_LABELS,
  threadLaunchActivityLine,
  threadLaunchPullRequests,
} from "./threadLaunch.logic";

/** The hook that ties a row to the reply above it, or, flipped, to the card under it. */
function Hook(props: { readonly arm?: "up" | "down" | undefined }) {
  return props.arm === "down" ? (
    <span
      aria-hidden
      className="mt-2.5 h-2.5 w-2.5 shrink-0 self-center rounded-tl-sm border-t border-l border-muted-foreground/40"
    />
  ) : (
    <span
      aria-hidden
      className="mb-1.5 h-2.5 w-2.5 shrink-0 self-center rounded-bl-sm border-b border-l border-muted-foreground/40"
    />
  );
}

const ROW = "flex min-w-0 max-w-full items-center gap-1.5 text-sm text-muted-foreground";

function PendingLaunchRow(props: { readonly launch: ForkThreadLaunch }) {
  return (
    <div className={ROW} data-fork-thread-launch-card={props.launch.callStatus}>
      <Hook />
      <span className="truncate">{props.launch.title ?? "New thread"}</span>
      <span className="shrink-0 text-xs">
        {props.launch.callStatus === "starting" ? "Starting" : "Could not start"}
      </span>
    </div>
  );
}

/** Opens a thread in a split beside the conversation, or goes to it where there is no room. */
export function useOpenThreadBeside(
  hostRef: ScopedThreadRef | null,
  threadRef: ScopedThreadRef,
): () => void {
  const router = useRouter();
  const splitPane = useSplitPane();
  return () => {
    // From a sprint, its panel shows the thread and the sprint keeps the column.
    if (openInSprintPanel(hostRef, threadRef)) return;
    if (
      hostRef !== null &&
      splitPane.canSplit &&
      scopedThreadKey(hostRef) !== scopedThreadKey(threadRef)
    ) {
      morphSplitPairs([hostRef, threadRef], () => {
        useSplitThreadStore.getState().pair(hostRef, threadRef);
      });
      return;
    }
    void router.navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(threadRef),
    });
  };
}

/** A thread as one hooked row: title, its status, its pull requests. */
export function ForkThreadHookRow(props: {
  readonly threadRef: ScopedThreadRef;
  readonly fallbackTitle: string | null;
  /** The conversation the row sits in, which the thread opens beside. */
  readonly hostRef: ScopedThreadRef | null;
  readonly kind: "launch" | "report" | "request";
  /** Down when the row heads a card below it instead of hanging off the reply above. */
  readonly arm?: "up" | "down" | undefined;
}) {
  const { threadRef } = props;
  const openThread = useOpenThreadBeside(props.hostRef, threadRef);
  const openPrLink = useOpenPrLink(threadRef);
  const thread = useQuietThreadShell(threadRef);
  const threadKey = scopedThreadKey(threadRef);
  const localVisit = useUiStateStore((state) => state.threadLastVisitedAtById[threadKey]);
  const status =
    thread === null
      ? null
      : resolveSidebarV2CardStatus(thread, {
          lastVisitedAt: resolveThreadLastVisitedAt(thread.lastVisitedAt, localVisit),
          wokeAt: null,
        }).topStatus;
  const title = thread?.title ?? props.fallbackTitle ?? "Thread";
  const error =
    status?.label === "Failed" ? threadLaunchActivityLine(thread?.source.lastError) : null;
  const pullRequests = thread === null ? [] : threadLaunchPullRequests(thread);
  const openPr = (event: MouseEvent<HTMLElement>, url: string) => {
    openPrLink(event, url);
  };

  return (
    <div
      className={ROW}
      data-fork-thread-launch-card={props.kind === "launch" ? "started" : props.kind}
    >
      <Hook arm={props.arm} />
      <button
        type="button"
        className="flex min-w-0 items-center gap-1.5 rounded-sm text-left outline-none hover:text-foreground focus-visible:text-foreground"
        onClick={openThread}
      >
        <span className="truncate">{title}</span>
        <span className="flex size-4 shrink-0 items-center justify-center">
          <SidebarV2StatusMark status={status} seed={threadKey} idle="dot" celebrate={false} />
        </span>
        {error === null ? null : <span className="min-w-0 truncate text-xs">{error}</span>}
      </button>
      {pullRequests.map((link) => {
        const Icon = link.stage === "merged" ? GitMergeIcon : GitPullRequestIcon;
        const stage = link.stage === null ? null : THREAD_PULL_REQUEST_STAGE_LABELS[link.stage];
        return (
          <Fragment key={link.url}>
            <button
              type="button"
              aria-label={`Pull request #${link.number}${link.title === null ? "" : `: ${link.title}`}${stage === null ? "" : `, ${stage.toLowerCase()}`}`}
              className="inline-flex h-5 shrink-0 items-center gap-1 rounded-md bg-muted px-1.5 text-xs hover:text-foreground"
              onClick={(event) => openPr(event, link.url)}
              onAuxClick={(event) => openPr(event, link.url)}
            >
              <Icon className="size-3" />#{link.number}
            </button>
            {stage === null ? null : (
              <span aria-hidden className="shrink-0 text-xs">
                {stage}
              </span>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

/** The threads one reply's turn started, one hooked row each. */
export function ForkThreadLaunchList(props: {
  readonly launches: ReadonlyArray<{ readonly id: string; readonly launch: ForkThreadLaunch }>;
  readonly className?: string;
}) {
  const ctx = use(TimelineRowCtx);
  return (
    <ul
      className={cn("flex flex-col gap-1 ps-1", props.className)}
      data-fork-thread-launch-cards=""
    >
      {props.launches.map(({ id, launch }) => (
        <li key={id} className="max-w-full">
          {launch.threadId === null ? (
            <PendingLaunchRow launch={launch} />
          ) : (
            <ForkThreadHookRow
              kind="launch"
              threadRef={scopeThreadRef(
                launch.environmentId ?? (ctx.activeThreadEnvironmentId as EnvironmentId),
                launch.threadId,
              )}
              fallbackTitle={launch.title}
              hostRef={ctx.threadRef}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

/** A turn's launches as their own timeline row, where the turn shows no reply to hang them on. */
export function ForkThreadLaunchTimelineRow(props: {
  readonly row: {
    readonly launches: ReadonlyArray<{ readonly id: string; readonly launch: ForkThreadLaunch }>;
  };
}) {
  return <ForkThreadLaunchList launches={props.row.launches} />;
}

/** A work report's notice as the row of the thread it came from, heading the reply it started.
    The plain notice shows when its thread is not on this machine's list. */
export function ForkWorkReportRow(props: {
  readonly itemId: string;
  readonly summary: string;
  readonly fallback: ReactNode;
}) {
  const ctx = use(TimelineRowCtx);
  const key = forkWorkReportKey(props.itemId);
  const threads = useQuietThreadShells();
  const environmentId = ctx.activeThreadEnvironmentId;
  const threadId =
    key === null
      ? null
      : forkWorkReportThreadId(
          key,
          threads.flatMap((thread) => (thread.environmentId === environmentId ? [thread.id] : [])),
        );
  const thread =
    threadId === null
      ? undefined
      : threads.find(
          (candidate) => candidate.environmentId === environmentId && candidate.id === threadId,
        );
  if (thread === undefined || key === null) return props.fallback;
  const request = forkWorkReportRequestKind(props.summary);
  // A question or approval still open is answered right here; once settled it keeps its answer.
  // Inset as a reply's text is, so its hook lines up with the launch rows under replies.
  return (
    <div className="ps-2">
      {request === null ? (
        <ForkThreadHookRow
          kind="report"
          threadRef={scopeThreadRef(environmentId, thread.id)}
          fallbackTitle={null}
          hostRef={ctx.threadRef}
        />
      ) : forkWorkReportIsPending(key, thread.id, thread.source.pendingRuntimeRequest?.id) ? (
        <ForkThreadRequestCard thread={thread} hostRef={ctx.threadRef} kind={request} />
      ) : (
        <ForkAnsweredRequest
          thread={thread}
          reportKey={key}
          hostRef={ctx.threadRef}
          kind={request}
        />
      )}
    </div>
  );
}
