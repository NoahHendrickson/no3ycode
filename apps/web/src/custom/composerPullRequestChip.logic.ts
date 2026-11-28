import {
  type ThreadPullRequestBadge,
  visibleThreadPullRequests,
} from "@t3tools/client-runtime/thread-pull-requests";
import type {
  PullRequestChecksState,
  ThreadPullRequestLink,
  ThreadPullRequestSnapshot,
} from "@t3tools/contracts";

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
  return pullRequestChipStateOf(pr);
}

/** One PR's chip state: a draft while open and a draft, else its own state. */
export function pullRequestChipStateOf(
  pr: Pick<NonNullable<ThreadPr>, "state" | "isDraft"> | null,
): PullRequestChipState | undefined {
  if (!pr) return undefined;
  return pr.state === "open" && pr.isDraft === true ? "draft" : pr.state;
}

/** The CI the chip's inner pill shows: the current PR's checks while it is open. A stack or a
 * thread with several PRs shows none, since its fill is the aggregate and one PR's CI would
 * stand in for the rest (a green pill over a failing layer). */
export function resolvePullRequestChipChecks(input: {
  readonly badge: ThreadPullRequestBadge | null;
  readonly snapshot: Pick<ThreadPullRequestSnapshot, "state" | "checksState"> | null | undefined;
}): PullRequestChecksState | null {
  const { badge, snapshot } = input;
  if (badge !== null && (badge.kind === "stack" || badge.others > 0)) return null;
  return pullRequestChecksOf(snapshot);
}

/** One PR's CI, shown while it is open. */
export function pullRequestChecksOf(
  snapshot: Pick<ThreadPullRequestSnapshot, "state" | "checksState"> | null | undefined,
): PullRequestChecksState | null {
  return snapshot?.state === "open" ? (snapshot.checksState ?? null) : null;
}
