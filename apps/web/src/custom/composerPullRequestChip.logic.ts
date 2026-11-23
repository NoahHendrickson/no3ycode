import {
  type ThreadPullRequestBadge,
  visibleThreadPullRequests,
} from "@t3tools/client-runtime/thread-pull-requests";
import type { ThreadPullRequestLink } from "@t3tools/contracts";

import type { ThreadPr } from "~/components/ThreadStatusIndicators";

export type PullRequestChipState = ThreadPullRequestBadge["state"];

/** The state the PR chip is filled by, in step with the glyph upstream's badge draws: the
 * aggregate for a stack or several PRs, else the PR's own resolved state. Undefined (neutral)
 * while nothing is known, including an aggregate that reads open only because a linked PR's
 * snapshot is still pending. */
export function resolvePullRequestChipState(input: {
  readonly badge: ThreadPullRequestBadge | null;
  readonly pr: Pick<NonNullable<ThreadPr>, "state" | "isDraft"> | null;
  readonly pullRequests: ReadonlyArray<ThreadPullRequestLink>;
}): PullRequestChipState | undefined {
  const { badge, pr } = input;
  if (badge !== null && (badge.kind === "stack" || badge.others > 0)) {
    const confirmedOpen = visibleThreadPullRequests(input.pullRequests).some(
      (link) => link.snapshot?.state === "open",
    );
    return badge.state === "open" && !confirmedOpen ? undefined : badge.state;
  }
  if (!pr) return undefined;
  return pr.state === "open" && pr.isDraft === true ? "draft" : pr.state;
}
