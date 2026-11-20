/**
 * New work a New agent draft offers, from the projects' open pull requests and
 * the picked checkout's git status — see
 * `.fork/customizations.yaml#fork-draft-project-quick-picks`.
 */
import type { EnvironmentId, PullRequestListEntry, ProjectId } from "@t3tools/contracts";

export type LaunchpadSuggestionKind =
  | "conflicts"
  | "checks"
  | "changes"
  | "review"
  | "commit"
  | "pull"
  | "open-pr"
  | "merge";

export interface LaunchpadSuggestion {
  readonly id: string;
  readonly kind: LaunchpadSuggestionKind;
  readonly title: string;
  readonly meta: string;
  readonly prompt: string;
  /** The project a pick from an unassigned draft moves it to; null for checkout work. */
  readonly project: { readonly environmentId: EnvironmentId; readonly projectId: ProjectId } | null;
}

export type LaunchpadPullRequest = PullRequestListEntry & { readonly environmentId: EnvironmentId };

/** The slice of a checkout's status the suggestions read. */
export interface LaunchpadGitStatus {
  readonly refName: string | null;
  readonly isDefaultRef: boolean;
  readonly hasPrimaryRemote: boolean;
  readonly changedFileCount: number;
  readonly hasUpstream: boolean;
  readonly behindCount: number;
  readonly aheadOfDefaultCount: number;
  readonly hasOpenPullRequest: boolean;
}

const LAUNCHPAD_SUGGESTION_LIMIT = 4;

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

function pullRequestSuggestion(
  pr: LaunchpadPullRequest,
  kind: LaunchpadSuggestionKind,
): LaunchpadSuggestion {
  const ref = `#${pr.number} · ${pr.title}`;
  const at = `pull request #${pr.number} (${pr.url})`;
  const project = { environmentId: pr.environmentId, projectId: pr.projectId };
  const id = `${kind}:${pr.url}`;
  switch (kind) {
    case "conflicts":
      return {
        id,
        kind,
        project,
        title: `Resolve conflicts on ${ref}`,
        meta: "Conflicts",
        prompt: `Resolve the merge conflicts on ${at}. Bring ${pr.headBranch} up to date with ${pr.baseBranch}, resolve the conflicts, run the affected tests, and push.`,
      };
    case "checks":
      return {
        id,
        kind,
        project,
        title: `Fix checks on ${ref}`,
        meta: "Checks failing",
        prompt: `The checks on ${at} are failing. Read the failing job logs, find the root cause, and push a fix to ${pr.headBranch}.`,
      };
    case "changes":
      return {
        id,
        kind,
        project,
        title: `Address review on ${ref}`,
        meta: "Changes requested",
        prompt: `Changes were requested on ${at}. Read the review comments, make the changes, and push them to ${pr.headBranch}.`,
      };
    case "review":
      return {
        id,
        kind,
        project,
        title: `Review ${ref}`,
        meta: "Review requested",
        prompt: `Review ${at}. Read the diff, then summarize the real issues ranked by severity.`,
      };
    default:
      return {
        id,
        kind: "merge",
        project,
        title: `Merge ${ref}`,
        meta: "Ready to merge",
        prompt: `${at} is approved and its checks pass. Confirm it is still mergeable, then merge it.`,
      };
  }
}

/** The one thing most worth doing on a pull request you opened, or null. */
function authoredKind(pr: LaunchpadPullRequest): LaunchpadSuggestionKind | null {
  if (pr.mergeability === "conflicting") return "conflicts";
  if (pr.checksState === "failing") return "checks";
  if (pr.reviewDecision === "changes-requested") return "changes";
  if (
    !pr.isDraft &&
    pr.reviewDecision === "approved" &&
    pr.checksState === "passing" &&
    pr.mergeability === "mergeable"
  ) {
    return "merge";
  }
  return null;
}

function gitSuggestions(git: LaunchpadGitStatus): LaunchpadSuggestion[] {
  const suggestions: LaunchpadSuggestion[] = [];
  const branch = git.refName;
  if (git.changedFileCount > 0) {
    const files = `${git.changedFileCount} ${plural(git.changedFileCount, "changed file", "changed files")}`;
    suggestions.push({
      id: "commit",
      kind: "commit",
      project: null,
      title: `Commit ${files}`,
      meta: "Uncommitted",
      prompt: `Look at the uncommitted changes in this checkout (${files}), group them into sensible commits, and commit them.`,
    });
  }
  if (branch !== null && git.hasUpstream && git.behindCount > 0) {
    const commits = `${git.behindCount} new ${plural(git.behindCount, "commit", "commits")}`;
    suggestions.push({
      id: "pull",
      kind: "pull",
      project: null,
      title: `Pull ${commits} on ${branch}`,
      meta: "Behind",
      prompt: `Pull the ${commits} on ${branch} into this checkout and summarize what changed.`,
    });
  }
  if (
    branch !== null &&
    !git.isDefaultRef &&
    git.hasPrimaryRemote &&
    !git.hasOpenPullRequest &&
    git.aheadOfDefaultCount > 0
  ) {
    suggestions.push({
      id: "open-pr",
      kind: "open-pr",
      project: null,
      title: `Open a pull request for ${branch}`,
      meta: "No PR",
      prompt: `Open a pull request for ${branch}. Summarize what the branch changes in the description.`,
    });
  }
  return suggestions;
}

/**
 * Broken work on your own pull requests first, then reviews asked of you,
 * then the checkout's git work, then pull requests ready to merge. Newest
 * first within each group, as the list arrives.
 */
export function deriveLaunchpadSuggestions(input: {
  readonly authored: ReadonlyArray<LaunchpadPullRequest>;
  readonly reviewing: ReadonlyArray<LaunchpadPullRequest>;
  readonly git: LaunchpadGitStatus | null;
}): LaunchpadSuggestion[] {
  const fixes: LaunchpadSuggestion[] = [];
  const merges: LaunchpadSuggestion[] = [];
  // A project on two machines lists its pull requests from both.
  const seen = new Set<string>();
  for (const pr of input.authored) {
    if (pr.state !== "open" || seen.has(pr.url)) continue;
    const kind = authoredKind(pr);
    if (kind === null) continue;
    seen.add(pr.url);
    (kind === "merge" ? merges : fixes).push(pullRequestSuggestion(pr, kind));
  }
  const reviews: LaunchpadSuggestion[] = [];
  for (const pr of input.reviewing) {
    if (pr.state !== "open" || !pr.viewerReviewRequested || seen.has(pr.url)) continue;
    seen.add(pr.url);
    reviews.push(pullRequestSuggestion(pr, "review"));
  }
  return [
    ...fixes,
    ...reviews,
    ...(input.git === null ? [] : gitSuggestions(input.git)),
    ...merges,
  ].slice(0, LAUNCHPAD_SUGGESTION_LIMIT);
}
