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

/** The thread's PR as a chip above the composer (fork-composer-shell), resolved the way
 * BranchToolbarBranchSelector resolved it in the context row. Renders nothing without a PR. */
export function ComposerPullRequestChip(props: {
  readonly threadRef: ScopedThreadRef;
  readonly branch: string | null;
  readonly cwd: string | null;
}) {
  const { threadRef } = props;
  const thread = useQuietThreadShell(threadRef);
  // The same query the branch picker reads, so the two share one status.
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
  // The chip's fill follows the PR's state; a draft keeps the neutral chip.
  // The glyph shows the aggregate only for a stack or several PRs; a single PR shows its own
  // resolved state, unknown (neutral) while its status is pending.
  const showsAggregate = pr.badge !== null && (pr.badge.kind === "stack" || pr.badge.others > 0);
  const state = showsAggregate
    ? pr.badge?.state
    : pr.pr
      ? pr.pr.state === "open" && pr.pr.isDraft === true
        ? "draft"
        : pr.pr.state
      : undefined;
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
