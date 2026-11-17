/**
 * What a digest line links, resolved against the threads in memory — see
 * `.fork/customizations.yaml#fork-bot-digest`: each linked thread, and each pull request the line
 * names or a linked thread has, with the thread it belongs to and what is known of its state.
 */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { sourceControlClients } from "@t3tools/client-runtime/source-control-clients";
import { resolveThreadCurrentPullRequestLink } from "@t3tools/client-runtime/thread-pull-requests";
import type {
  EnvironmentId,
  ThreadLinkedPullRequest,
  ThreadPullRequestSnapshot,
} from "@t3tools/contracts";
import { type ThreadLink, threadLinkCandidates } from "@t3tools/shared/threadLinks";

import type { BotDigestItem } from "./botDigestSections";

export interface BotPullRequest {
  readonly url: string;
  readonly number: number;
  /** Its state from a thread's own link; null when only its branch or a line names it. */
  readonly snapshot: ThreadPullRequestSnapshot | null;
  /** The thread's branch pull request this is, whose state the shared summaries may hold. */
  readonly branch: ThreadLinkedPullRequest | null;
}

export interface BotDigestLinks {
  readonly threads: ReadonlyArray<{
    readonly link: ThreadLink;
    /** The bot's words for it, which name it when it does not resolve. */
    readonly label: string;
    readonly shell: EnvironmentThreadShell | undefined;
  }>;
  readonly pullRequests: ReadonlyArray<
    BotPullRequest & { readonly thread: EnvironmentThreadShell | undefined }
  >;
}

/** A thread's pull request in the sidebar badge's order: its linked one, else its branch's. */
export function botThreadPullRequest(shell: EnvironmentThreadShell): BotPullRequest | null {
  const current = resolveThreadCurrentPullRequestLink(shell.pullRequests);
  if (current !== null) {
    return { url: current.url, number: current.number, snapshot: current.snapshot, branch: null };
  }
  const branch = shell.branchPullRequest ?? null;
  return branch === null
    ? null
    : { url: branch.url, number: branch.number, snapshot: null, branch };
}

function pullRequestsOf(shell: EnvironmentThreadShell): ReadonlyArray<BotPullRequest> {
  const linked = shell.pullRequests.map((pullRequest) => ({
    url: pullRequest.url,
    number: pullRequest.number,
    snapshot: pullRequest.snapshot,
    branch: null,
  }));
  const branch = shell.branchPullRequest;
  return branch == null
    ? linked
    : [...linked, { url: branch.url, number: branch.number, snapshot: null, branch }];
}

/** One pull request however its URL is written: a deep link names the same one. */
function identity(url: string): string {
  const link = sourceControlClients.parseChangeRequestUrl(url)?.link;
  return link === undefined ? url : `${link.host}/${link.repository}#${link.number}`;
}

export function resolveBotDigestLinks(
  item: BotDigestItem,
  shells: ReadonlyArray<EnvironmentThreadShell>,
  environmentId: EnvironmentId,
): BotDigestLinks {
  const threads: Array<BotDigestLinks["threads"][number]> = [];
  for (const { link, label } of item.threads) {
    const refs = threadLinkCandidates(link, environmentId);
    const shell = shells.find((candidate) =>
      refs.some(
        (ref) => ref.threadId === candidate.id && ref.environmentId === candidate.environmentId,
      ),
    );
    // One thread written two ways (v1 and v2, escaped and not) is one chip.
    if (shell === undefined || !threads.some((entry) => entry.shell === shell)) {
      threads.push({ link, label, shell });
    }
  }
  const linked = threads.flatMap(({ shell }) => (shell === undefined ? [] : [shell]));
  const pullRequests: Array<BotPullRequest & { thread: EnvironmentThreadShell | undefined }> = [];
  const listed = (url: string) =>
    pullRequests.some((pullRequest) => identity(pullRequest.url) === identity(url));
  // The pull requests the line names, kept as written so a deep link opens where it points.
  for (const named of item.pullRequests) {
    if (listed(named.url)) continue;
    const same = (pullRequest: BotPullRequest) => identity(pullRequest.url) === identity(named.url);
    const thread = linked.find((shell) => pullRequestsOf(shell).some(same));
    const known =
      [...linked, ...shells]
        .flatMap(pullRequestsOf)
        .find((pr) => same(pr) && pr.snapshot !== null) ??
      (thread === undefined ? undefined : pullRequestsOf(thread).find(same));
    pullRequests.push({
      url: named.url,
      number: named.number,
      snapshot: known?.snapshot ?? null,
      branch: known?.branch ?? null,
      thread,
    });
  }
  // Then each linked thread's own that the line leaves out.
  for (const shell of linked) {
    const own = botThreadPullRequest(shell);
    if (own !== null && !listed(own.url)) pullRequests.push({ ...own, thread: shell });
  }
  return { threads, pullRequests };
}
