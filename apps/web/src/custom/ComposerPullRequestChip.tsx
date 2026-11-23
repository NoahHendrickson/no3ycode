import type { ScopedThreadRef } from "@t3tools/contracts";

import { ComposerControl } from "~/components/chat/ComposerControl";
import {
  ThreadPullRequestBadgeControl,
  resolveDisplayedThreadPr,
  useThreadDisplayedPullRequest,
} from "~/components/ThreadStatusIndicators";
import { useOpenPrLink } from "~/lib/openPullRequestLink";
import { useQuietThreadShell } from "~/state/entities";
import { useEnvironmentQuery } from "~/state/query";
import { useRightPanelStore } from "~/rightPanelStore";
import { vcsEnvironment } from "~/state/vcs";

import { resolvePullRequestChipState } from "./composerPullRequestChip.logic";

/** The thread's PR as a chip above the composer (fork-composer-shell), resolved the way
 * BranchToolbarBranchSelector resolved it in the context row. Renders nothing without a PR. */
export function ComposerPullRequestChip(props: {
  readonly threadRef: ScopedThreadRef;
  readonly branch: string | null;
  /** ChatView's git-status cwd, so this reads its subscription. */
  readonly cwd: string | null;
}) {
  const { threadRef } = props;
  const thread = useQuietThreadShell(threadRef);
  // The full status, not ChatView's trimmed one: it names the host, which words "PR" or "MR".
  const status = useEnvironmentQuery(
    props.cwd === null
      ? null
      : vcsEnvironment.status({
          environmentId: threadRef.environmentId,
          input: { cwd: props.cwd },
        }),
  );
  const branchPr = resolveDisplayedThreadPr({
    threadBranch: props.branch,
    gitStatus: status.data,
  });
  const pr = useThreadDisplayedPullRequest(
    threadRef.environmentId,
    thread,
    branchPr,
    status.data?.sourceControlProvider,
  );
  const openPrLink = useOpenPrLink(threadRef);
  const prUrl = pr.url;
  const state = resolvePullRequestChipState({
    badge: pr.badge,
    pr: pr.pr,
    pullRequests: thread?.pullRequests ?? [],
  });
  return (
    <ThreadPullRequestBadgeControl
      render={
        <ComposerControl
          size="xs"
          data-fork-composer-status-chip="pull-request"
          data-fork-pr-chip
          data-pr-state={state}
        />
      }
      badge={pr.badge}
      pullRequests={thread?.pullRequests ?? []}
      number={pr.number}
      url={pr.url}
      status={pr.status}
      onOpenList={() => useRightPanelStore.getState().open(threadRef, "pull-requests")}
      onOpenPullRequest={(event, targetUrl) => {
        const url = targetUrl ?? prUrl;
        if (url) openPrLink(event, url);
      }}
    />
  );
}
