/**
 * The one next step a settled thread offers as a pill above the composer, following the
 * owner's usual chain: sol loop → open PR → babysit → merge → cut release. Learned habits
 * (composerHabits) fill in where no rule speaks. See
 * `.fork/customizations.yaml#fork-composer-next-step`.
 */
import type { ThreadPullRequestLink } from "@t3tools/contracts";
import { visibleThreadPullRequests } from "@t3tools/shared/threadPullRequests";

export type ComposerNextStepKind = "open-pr" | "babysit" | "merge" | "release";

export interface ComposerNextStep {
  readonly kind: ComposerNextStepKind;
  readonly label: string;
  readonly prompt: string;
}

const STEPS: Record<ComposerNextStepKind, ComposerNextStep> = {
  "open-pr": { kind: "open-pr", label: "Open PR", prompt: "Open a PR" },
  babysit: {
    kind: "babysit",
    label: "Babysit PR",
    prompt: "Babysit the PR and address any feedback",
  },
  merge: {
    kind: "merge",
    label: "Merge PR",
    prompt: "Check the reviews and comments on the PR, then merge it if it's ready",
  },
  release: { kind: "release", label: "Cut release", prompt: "Cut a new release" },
};

/** Only this fork ships releases from merged PRs (fork-release.yml). */
const RELEASE_REPOSITORY = "noahhendrickson/no3ycode";

/** The thread's PR as far as the next step cares. */
export interface NextStepPullRequest {
  readonly state: "open" | "closed" | "merged";
  readonly watching: boolean;
  /** A watch ran on it and ended. */
  readonly watchedBefore: boolean;
  /** Not a draft, checks pass, mergeable, and no changes requested. */
  readonly ready: boolean;
  readonly releasable: boolean;
}

export interface NextStepGitStatus {
  readonly isDefaultRef: boolean;
  readonly hasPrimaryRemote: boolean;
  /** Uncommitted files or commits ahead of the default branch. */
  readonly hasWork: boolean;
}

export interface ComposerNextStepInput {
  /** The owner's latest typed message, or null when none is loaded. */
  readonly lastOwnerPrompt: string | null;
  readonly pullRequest: NextStepPullRequest | null;
  readonly git: NextStepGitStatus | null;
}

const SOL_LOOP = /\bsol[\s-]?loop\b/u;
const MERGE = /\bmerge\b/u;

/**
 * The next step, "hold" when the PR is the owner's call (watched, or a watch ended short of
 * mergeable) so nothing, learned or not, is offered, or null when no rule speaks.
 */
export function resolveComposerNextStep(
  input: ComposerNextStepInput,
): ComposerNextStep | "hold" | null {
  const said = input.lastOwnerPrompt?.toLowerCase() ?? "";
  const pr = input.pullRequest;
  if (pr !== null) {
    if (pr.state === "merged") {
      return pr.releasable && MERGE.test(said) ? STEPS.release : null;
    }
    if (pr.state !== "open") return null;
    if (pr.watching) return "hold";
    if (!pr.watchedBefore) return STEPS.babysit;
    return pr.ready ? STEPS.merge : "hold";
  }
  const git = input.git;
  return SOL_LOOP.test(said) &&
    git !== null &&
    git.hasWork &&
    !git.isDefaultRef &&
    git.hasPrimaryRemote
    ? STEPS["open-pr"]
    : null;
}

/** The most recently linked PR, read for the next step; a dismissed stack member is not one. */
export function nextStepPullRequestFromLinks(
  links: ReadonlyArray<ThreadPullRequestLink>,
): NextStepPullRequest | null {
  const link = visibleThreadPullRequests(links).reduce<ThreadPullRequestLink | null>(
    (latest, candidate) =>
      latest === null || candidate.linkedAt > latest.linkedAt ? candidate : latest,
    null,
  );
  const snapshot = link?.snapshot;
  if (!link || !snapshot) return null;
  return {
    state: snapshot.state,
    watching: link.watch !== undefined,
    watchedBefore: link.endedWatch !== undefined,
    ready:
      !snapshot.isDraft &&
      snapshot.checksState === "passing" &&
      snapshot.mergeability === "mergeable" &&
      snapshot.reviewDecision !== "changes-requested",
    releasable: link.repository.toLowerCase() === RELEASE_REPOSITORY,
  };
}

/** The branch's PR from git status, for a PR the agent opened without linking it to the thread.
    Nothing watches an unlinked PR, and its checks are unknown. */
export function nextStepPullRequestFromBranch(
  pr: { readonly state: "open" | "closed" | "merged"; readonly url: string } | null,
): NextStepPullRequest | null {
  if (pr === null) return null;
  return {
    state: pr.state,
    watching: false,
    watchedBefore: false,
    ready: false,
    releasable: pr.url.toLowerCase().includes(`github.com/${RELEASE_REPOSITORY}/`),
  };
}

interface NextStepMessage {
  readonly role: "user" | "assistant" | "system";
  readonly createdBy: "user" | "agent" | "system";
  readonly text: string;
  readonly scheduledTaskId?: string | undefined;
  readonly notification?: unknown;
  readonly context?: { readonly guest?: unknown } | undefined;
}

/**
 * The owner's latest typed message. Scheduled tasks, watch wakes, guests' messages and
 * agent-sent messages (CLI turns included) are not the owner typing.
 */
export function lastOwnerPrompt(messages: ReadonlyArray<NextStepMessage>): string | null {
  return (
    messages.findLast(
      (message) =>
        message.role === "user" &&
        message.createdBy === "user" &&
        message.scheduledTaskId === undefined &&
        message.notification === undefined &&
        message.context?.guest === undefined,
    )?.text ?? null
  );
}
