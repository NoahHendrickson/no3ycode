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
  | "merge"
  | "review-open"
  | "dev-server";

export interface LaunchpadSuggestion {
  readonly id: string;
  readonly kind: LaunchpadSuggestionKind;
  readonly title: string;
  readonly prompt: string;
  /** The project a pick from an unassigned draft moves it to; null for checkout work. */
  readonly project: { readonly environmentId: EnvironmentId; readonly projectId: ProjectId } | null;
  /** "local" for git work, which belongs to the project's own checkout, never a new worktree;
      null takes the project's default. */
  readonly envMode: "local" | null;
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
        envMode: null,
        title: `Resolve conflicts on ${ref}`,
        prompt: `Resolve the merge conflicts on ${at}. Bring ${pr.headBranch} up to date with ${pr.baseBranch}, resolve the conflicts, run the affected tests, and push.`,
      };
    case "checks":
      return {
        id,
        kind,
        project,
        envMode: null,
        title: `Fix checks on ${ref}`,
        prompt: `The checks on ${at} are failing. Read the failing job logs, find the root cause, and push a fix to ${pr.headBranch}.`,
      };
    case "changes":
      return {
        id,
        kind,
        project,
        envMode: null,
        title: `Address review on ${ref}`,
        prompt: `Changes were requested on ${at}. Read the review comments, make the changes, and push them to ${pr.headBranch}.`,
      };
    case "review":
      return {
        id,
        kind,
        project,
        envMode: null,
        title: `Review ${ref}`,
        prompt: `Review ${at}. Read the diff, then summarize the real issues ranked by severity.`,
      };
    default:
      return {
        id,
        kind: "merge",
        project,
        envMode: null,
        title: `Merge ${ref}`,
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

/** A checkout whose git work to offer: the picked project's own (no project or name, since the
    draft already names it), or, for a draft with no project yet, a recent project's, whose work
    names the project and picking it moves the draft there. */
export interface LaunchpadCheckout {
  readonly project: LaunchpadSuggestion["project"];
  readonly name: string | null;
  readonly git: LaunchpadGitStatus;
}

function gitSuggestions({ project, name, git }: LaunchpadCheckout): LaunchpadSuggestion[] {
  const suggestions: LaunchpadSuggestion[] = [];
  const branch = git.refName;
  const id = (kind: string) =>
    project === null ? kind : `${kind}:${project.environmentId}:${project.projectId}`;
  const where = name === null ? "" : ` in ${name}`;
  if (git.changedFileCount > 0) {
    const files = `${git.changedFileCount} ${plural(git.changedFileCount, "changed file", "changed files")}`;
    suggestions.push({
      id: id("commit"),
      kind: "commit",
      project,
      envMode: "local",
      title: `Commit ${files}${where}`,
      prompt: `Look at the uncommitted changes in this checkout (${files}), group them into sensible commits, and commit them.`,
    });
  }
  if (branch !== null && git.hasUpstream && git.behindCount > 0) {
    const commits = `${git.behindCount} new ${plural(git.behindCount, "commit", "commits")}`;
    suggestions.push({
      id: id("pull"),
      kind: "pull",
      project,
      envMode: "local",
      title: name === null ? `Pull ${commits} on ${branch}` : `Pull ${commits} into ${name}`,
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
      id: id("open-pr"),
      kind: "open-pr",
      project,
      envMode: "local",
      title: `Open a pull request for ${branch}${where}`,
      prompt: `Open a pull request for ${branch}. Summarize what the branch changes in the description.`,
    });
  }
  return suggestions;
}

/** One "review the open pull requests" row per project, listing the numbers so the agent
    reviews exactly these. */
function reviewOpenSuggestions(
  openPullRequests: ReadonlyArray<LaunchpadPullRequest>,
): LaunchpadSuggestion[] {
  const byProject = new Map<
    string,
    { readonly project: NonNullable<LaunchpadSuggestion["project"]>; readonly numbers: number[] }
  >();
  for (const pr of openPullRequests) {
    const key = `${pr.environmentId}:${pr.projectId}`;
    const group = byProject.get(key) ?? {
      project: { environmentId: pr.environmentId, projectId: pr.projectId },
      numbers: [],
    };
    group.numbers.push(pr.number);
    byProject.set(key, group);
  }
  return [...byProject].map(([key, { project, numbers }]) => ({
    id: `review-open:${key}`,
    kind: "review-open",
    project,
    envMode: null,
    title: `Review ${numbers.length} open ${plural(numbers.length, "PR", "PRs")}`,
    prompt: `Code-review the open PRs (${numbers.map((number) => `#${number}`).join(", ")}), leave your reviews on them, and tell me which are ready to merge.`,
  }));
}

const DEV_SERVER_SUGGESTION: LaunchpadSuggestion = {
  id: "dev-server",
  kind: "dev-server",
  project: null,
  envMode: "local",
  title: "Start the dev server",
  prompt: "Start the dev server and give me a link.",
};

/**
 * Broken work on your own pull requests first, then reviews asked of you, then a review of
 * every open pull request, then the checkout's git work, then pull requests ready to merge,
 * then starting the picked project's dev server. Newest first within each group, as the list
 * arrives.
 */
export function deriveLaunchpadSuggestions(input: {
  readonly authored: ReadonlyArray<LaunchpadPullRequest>;
  readonly reviewing: ReadonlyArray<LaunchpadPullRequest>;
  readonly checkouts: ReadonlyArray<LaunchpadCheckout>;
  /** A picked project, so its own dev server is worth offering. */
  readonly offerDevServer?: boolean;
}): LaunchpadSuggestion[] {
  const fixes: LaunchpadSuggestion[] = [];
  const merges: LaunchpadSuggestion[] = [];
  // A project on two machines lists its pull requests from both.
  const seen = new Set<string>();
  const open = new Map<string, LaunchpadPullRequest>();
  for (const pr of [...input.authored, ...input.reviewing]) {
    if (pr.state === "open" && !open.has(pr.url)) open.set(pr.url, pr);
  }
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
    ...reviewOpenSuggestions([...open.values()]),
    ...input.checkouts.flatMap(gitSuggestions),
    ...merges,
    ...(input.offerDevServer ? [DEV_SERVER_SUGGESTION] : []),
  ].slice(0, LAUNCHPAD_SUGGESTION_LIMIT);
}
