/**
 * One line of a bot's digest — see `.fork/customizations.yaml#fork-bot-digest`: its words, then
 * the threads and pull requests it links, each with its status and opening it, and on a Needs
 * you line a Reply that quotes it in the bot's conversation.
 */
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { resolveThreadCurrentPullRequestLink } from "@t3tools/client-runtime/thread-pull-requests";
import type { ScopedThreadRef, ThreadPullRequestLink } from "@t3tools/contracts";
import { threadLinkCandidates, unknownThreadLinkLabel } from "@t3tools/shared/threadLinks";
import { useNavigate } from "@tanstack/react-router";
import { ReplyIcon } from "lucide-react";
import type { MouseEvent } from "react";

import { PullRequestGlyph } from "~/components/pullRequest/pullRequestIcons";
import { resolvePullRequestState } from "~/components/pullRequest/pullRequestPresentation";
import { resolveThreadLastVisitedAt } from "~/components/Sidebar.logic";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { useComposerDraftStore } from "~/composerDraftStore";
import { useOpenPrLink } from "~/lib/openPullRequestLink";
import { cn } from "~/lib/utils";
import { buildThreadRouteParams } from "~/threadRoutes";

import { resolveSidebarV2CardStatus } from "../sidebarV2CardStatus";
import { SidebarV2StatusMark } from "../SidebarV2StatusIndicator";
import type { BotDigestItem } from "./botDigestSections";
import { closeBotThreadsPanel } from "./botThreadsPanelStore";

/** What the digest reads its links against: the threads in memory and the local visits. */
export interface BotDigestThreads {
  readonly shells: ReadonlyArray<EnvironmentThreadShell>;
  readonly localVisits: Readonly<Record<string, string>>;
}

const chipClassName =
  "flex min-w-0 cursor-pointer items-center gap-1 rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none";

function findShell(
  shells: ReadonlyArray<EnvironmentThreadShell>,
  refs: ReadonlyArray<ScopedThreadRef>,
): EnvironmentThreadShell | undefined {
  return shells.find((shell) =>
    refs.some((ref) => ref.threadId === shell.id && ref.environmentId === shell.environmentId),
  );
}

export function BotDigestItemRow(props: {
  readonly item: BotDigestItem;
  readonly botRef: ScopedThreadRef;
  readonly threads: BotDigestThreads;
  readonly needsYou: boolean;
  /** A Needs you request is its own card. */
  readonly className?: string | undefined;
}) {
  const { item, botRef, threads } = props;
  const navigate = useNavigate();
  const openPullRequest = useOpenPrLink();
  const linked = item.threads.map((link) => ({
    link,
    shell: findShell(threads.shells, threadLinkCandidates(link, botRef.environmentId)),
  }));
  const linkedShells = linked.flatMap((entry) => (entry.shell === undefined ? [] : [entry.shell]));
  // The pull requests the line names, then each linked thread's own that it leaves out.
  const pullRequests: Array<{
    url: string;
    number: number;
    thread: EnvironmentThreadShell | undefined;
  }> = item.pullRequests.map((pullRequest) => ({
    ...pullRequest,
    thread: linkedShells.find(
      (shell) =>
        shell.pullRequests.some((pr) => pr.url === pullRequest.url) ||
        shell.branchPullRequest?.url === pullRequest.url,
    ),
  }));
  for (const shell of linkedShells) {
    // The sidebar badge's order: a linked pull request, else the one found for its branch.
    const current =
      resolveThreadCurrentPullRequestLink(shell.pullRequests) ?? shell.branchPullRequest ?? null;
    if (current !== null && !pullRequests.some((pullRequest) => pullRequest.url === current.url)) {
      pullRequests.push({ url: current.url, number: current.number, thread: shell });
    }
  }
  const knownPullRequest = (url: string): ThreadPullRequestLink | undefined => {
    for (const shell of [...linkedShells, ...threads.shells]) {
      const match = shell.pullRequests.find((pr) => pr.url === url);
      if (match !== undefined) return match;
    }
    return undefined;
  };
  const openThread = (shell: EnvironmentThreadShell) =>
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(scopeThreadRef(shell.environmentId, shell.id)),
    });
  const reply = (event: MouseEvent<HTMLElement>) => {
    // A sheet would cover the composer the draft lands in; an inline panel sits beside it.
    if (event.currentTarget.closest('[data-preview-panel-mode="sheet"]') !== null) {
      closeBotThreadsPanel(botRef);
    }
    const store = useComposerDraftStore.getState();
    const existing = store.getComposerDraft(botRef)?.prompt.trimEnd() ?? "";
    const quote = `> ${item.source}\n\n`;
    store.setPrompt(botRef, existing === "" ? quote : `${existing}\n\n${quote}`);
    void navigate({ to: "/$environmentId/$threadId", params: buildThreadRouteParams(botRef) });
  };
  const text = item.text || linkedShells[0]?.title || "";
  const hasMeta = linked.length > 0 || pullRequests.length > 0 || props.needsYou;
  return (
    <li className={cn("flex flex-col gap-2", props.className)}>
      {text === "" ? null : (
        <span className="text-sm leading-5 break-words text-foreground">{text}</span>
      )}
      {hasMeta ? (
        <span className="flex min-w-0 items-center gap-3 text-xs leading-4 text-muted-foreground">
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
            {linked.map(({ link, shell }) => {
              if (shell === undefined) {
                return (
                  <span key={`${link.environmentId}/${link.threadId}`} className="truncate">
                    {unknownThreadLinkLabel(link, botRef.environmentId)}
                  </span>
                );
              }
              const key = scopedThreadKey(scopeThreadRef(shell.environmentId, shell.id));
              return (
                <BotDigestThreadChip
                  key={key}
                  shell={shell}
                  localVisit={threads.localVisits[key]}
                  onOpen={() => openThread(shell)}
                />
              );
            })}
            {pullRequests.map((pullRequest) => {
              const known = knownPullRequest(pullRequest.url);
              const state =
                known?.snapshot == null ? null : resolvePullRequestState(known.snapshot);
              const Icon = state?.Icon ?? PullRequestGlyph.pullRequest;
              return (
                <Tooltip key={pullRequest.url}>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        className={cn(chipClassName, "shrink-0 tabular-nums", state?.toneClassName)}
                        onClick={(event) => {
                          const { thread } = pullRequest;
                          const ref =
                            thread === undefined
                              ? undefined
                              : scopeThreadRef(thread.environmentId, thread.id);
                          // It opened in that thread's right panel, which shows once the thread does.
                          if (
                            openPullRequest(event, pullRequest.url, ref) &&
                            thread !== undefined
                          ) {
                            openThread(thread);
                          }
                        }}
                        data-testid="bot-digest-pull-request"
                      />
                    }
                  >
                    <Icon aria-hidden className="size-3 shrink-0" />
                    <span className="sr-only">
                      {state === null ? "Pull request" : `${state.label} pull request`}
                    </span>
                    {pullRequest.number}
                  </TooltipTrigger>
                  <TooltipPopup side="top">
                    {known?.snapshot?.title ?? pullRequest.url}
                  </TooltipPopup>
                </Tooltip>
              );
            })}
          </span>
          {props.needsYou ? (
            <Button size="xs" onClick={reply} data-testid="bot-digest-reply">
              <ReplyIcon />
              Reply
            </Button>
          ) : null}
        </span>
      ) : null}
    </li>
  );
}

/** A linked thread: its sidebar status mark and title, opening it. */
function BotDigestThreadChip(props: {
  readonly shell: EnvironmentThreadShell;
  readonly localVisit: string | undefined;
  readonly onOpen: () => void;
}) {
  const { shell } = props;
  const key = scopedThreadKey(scopeThreadRef(shell.environmentId, shell.id));
  const card = resolveSidebarV2CardStatus(shell, {
    lastVisitedAt: resolveThreadLastVisitedAt(shell.lastVisitedAt, props.localVisit),
    wokeAt: null,
  });
  return (
    <button
      type="button"
      className={cn(chipClassName, "max-w-full")}
      onClick={props.onOpen}
      data-testid="bot-digest-thread"
    >
      <span className="flex h-4 w-3 shrink-0 items-center justify-center">
        <SidebarV2StatusMark status={card.topStatus} seed={key} idle="dot" />
      </span>
      <span className="truncate">{shell.title}</span>
    </button>
  );
}
