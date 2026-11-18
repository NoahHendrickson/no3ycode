/**
 * One line of a bot's digest — see `.fork/customizations.yaml#fork-bot-digest`: its words, then
 * the threads and pull requests it links (botDigestItemLinks), each opening its target.
 */
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { EnvironmentId } from "@t3tools/contracts";
import { unknownThreadLinkLabel } from "@t3tools/shared/threadLinks";
import { useNavigate } from "@tanstack/react-router";

import { resolveThreadLastVisitedAt } from "~/components/Sidebar.logic";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { useOpenPrLink } from "~/lib/openPullRequestLink";
import { cn } from "~/lib/utils";
import { buildThreadRouteParams } from "~/threadRoutes";

import { resolveSidebarV2CardStatus } from "../sidebarV2CardStatus";
import { SidebarV2StatusMark } from "../SidebarV2StatusIndicator";
import {
  type BotDigestLinks,
  type BotPullRequest,
  resolveBotDigestLinks,
} from "./botDigestItemLinks";
import { BotPullRequestMark, useBotPullRequestState } from "./BotPullRequestMark";
import type { BotDigestItem } from "./botDigestSections";

/** The threads the panel already holds, which the digest reads its links against. */
export interface BotDigestThreads {
  readonly shells: ReadonlyArray<EnvironmentThreadShell>;
  readonly localVisits: Readonly<Record<string, string>>;
}

const chipClassName =
  "flex min-w-0 cursor-pointer items-center gap-1 rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none";

function useOpenThread() {
  const navigate = useNavigate();
  return (shell: EnvironmentThreadShell) =>
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(scopeThreadRef(shell.environmentId, shell.id)),
    });
}

/** A line's links, read against the panel's threads, and its words: the bot's, else the title
    of the first thread it links. */
export function resolveBotDigestLine(
  item: BotDigestItem,
  threads: BotDigestThreads,
  environmentId: EnvironmentId,
) {
  const links = resolveBotDigestLinks(item, threads.shells, environmentId);
  const text = item.text || links.threads.find((entry) => entry.shell)?.shell?.title || "";
  return { text, links };
}

export function BotDigestWords(props: { readonly text: string }) {
  return <span className="text-sm leading-5 break-words text-foreground">{props.text}</span>;
}

/** The threads and pull requests a line links, each opening its target. */
export function BotDigestLinkRow(props: {
  readonly links: BotDigestLinks;
  readonly environmentId: EnvironmentId;
  readonly localVisits: BotDigestThreads["localVisits"];
  readonly className?: string;
}) {
  const { links } = props;
  if (links.threads.length === 0 && links.pullRequests.length === 0) return null;
  return (
    <span
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-4 text-muted-foreground",
        props.className,
      )}
    >
      {links.threads.map(({ link, label, shell }) =>
        shell === undefined ? (
          <span key={`${link.environmentId}/${link.threadId}`} className="truncate">
            {label || unknownThreadLinkLabel(link, props.environmentId)}
          </span>
        ) : (
          <BotDigestThreadChip
            key={`${shell.environmentId}/${shell.id}`}
            shell={shell}
            localVisits={props.localVisits}
          />
        ),
      )}
      {links.pullRequests.map((pullRequest) => (
        <BotDigestPullRequestChip
          key={pullRequest.url}
          pullRequest={pullRequest}
          thread={pullRequest.thread}
          environmentId={pullRequest.thread?.environmentId ?? props.environmentId}
        />
      ))}
    </span>
  );
}

/** A linked thread: its sidebar status mark and title, opening it. */
function BotDigestThreadChip(props: {
  readonly shell: EnvironmentThreadShell;
  readonly localVisits: Readonly<Record<string, string>>;
}) {
  const { shell } = props;
  const openThread = useOpenThread();
  const key = scopedThreadKey(scopeThreadRef(shell.environmentId, shell.id));
  const card = resolveSidebarV2CardStatus(shell, {
    lastVisitedAt: resolveThreadLastVisitedAt(shell.lastVisitedAt, props.localVisits[key]),
    wokeAt: null,
  });
  return (
    <button
      type="button"
      className={cn(chipClassName, "max-w-full")}
      onClick={() => openThread(shell)}
      data-testid="bot-digest-thread"
    >
      <span className="flex h-4 w-3 shrink-0 items-center justify-center">
        <SidebarV2StatusMark status={card.topStatus} seed={key} idle="dot" />
      </span>
      <span className="truncate">{shell.title}</span>
    </button>
  );
}

/** A pull request: its state and number, opening it as the sidebar badge does, in its thread's
    right panel when it has a thread, which then opens so the panel shows. */
function BotDigestPullRequestChip(props: {
  readonly pullRequest: BotPullRequest;
  readonly thread: EnvironmentThreadShell | undefined;
  readonly environmentId: EnvironmentId;
}) {
  const { pullRequest, thread } = props;
  const openPullRequest = useOpenPrLink();
  const openThread = useOpenThread();
  const { state, title } = useBotPullRequestState(pullRequest, props.environmentId);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className={chipClassName}
            onClick={(event) => {
              const ref =
                thread === undefined ? undefined : scopeThreadRef(thread.environmentId, thread.id);
              if (openPullRequest(event, pullRequest.url, ref) && thread !== undefined) {
                openThread(thread);
              }
            }}
            data-testid="bot-digest-pull-request"
          />
        }
      >
        <BotPullRequestMark number={pullRequest.number} state={state} />
      </TooltipTrigger>
      <TooltipPopup side="top">{title ?? pullRequest.url}</TooltipPopup>
    </Tooltip>
  );
}
