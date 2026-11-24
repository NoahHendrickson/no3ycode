/**
 * The one next step a settled thread offers as a pill above the composer, following the
 * owner's usual chain: sol loop → open PR → babysit → merge → cut release. Learned habits
 * (forkComposerHabits) fill in where no rule speaks. See
 * `.fork/customizations.yaml#fork-composer-next-step`.
 */
import type { ThreadPullRequestLink } from "@t3tools/contracts";

import type { HabitSuggestion } from "./forkComposerHabits.ts";
import { resolveThreadCurrentPullRequestLink } from "./threadPullRequests.ts";

export type ComposerNextStepKind = "open-pr" | "babysit" | "merge" | "release";

interface ComposerNextStep {
  readonly kind: ComposerNextStepKind;
  readonly label: string;
  readonly prompt: string;
}

const STEPS: Record<ComposerNextStepKind, ComposerNextStep> = {
  // oxlint-disable-next-line t3code/no-untranslated-copy -- fork copy stays English (fork-i18n-catalog)
  "open-pr": { kind: "open-pr", label: "Open PR", prompt: "Open a PR" },
  babysit: {
    kind: "babysit",
    // oxlint-disable-next-line t3code/no-untranslated-copy -- fork copy stays English (fork-i18n-catalog)
    label: "Babysit PR",
    prompt: "Babysit the PR and address any feedback",
  },
  merge: {
    kind: "merge",
    // oxlint-disable-next-line t3code/no-untranslated-copy -- fork copy stays English (fork-i18n-catalog)
    label: "Merge PR",
    prompt: "Check the reviews and comments on the PR, then merge it if it's ready",
  },
  // oxlint-disable-next-line t3code/no-untranslated-copy -- fork copy stays English (fork-i18n-catalog)
  release: { kind: "release", label: "Cut release", prompt: "Cut a new release" },
};

/** Only this fork ships releases from merged PRs (fork-release.yml). */
function isReleaseRepository(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);
    return (
      hostname === "github.com" && pathname.toLowerCase().startsWith("/noahhendrickson/no3ycode/")
    );
  } catch {
    return false;
  }
}

/** The thread's PR as far as the next step cares. */
interface NextStepPullRequest {
  readonly state: "open" | "closed" | "merged";
  readonly watching: boolean;
  /** A watch ran on it and ended. */
  readonly watchedBefore: boolean;
  /** Not a draft, checks pass, mergeable, and no changes requested. */
  readonly ready: boolean;
  readonly releasable: boolean;
}

interface NextStepGit {
  readonly isDefaultRef: boolean;
  readonly hasPrimaryRemote: boolean;
  /** Uncommitted files or commits ahead of the default branch. */
  readonly hasWork: boolean;
}

interface ComposerNextStepInput {
  readonly lastOwnerPrompt: string | null;
  readonly pullRequest: NextStepPullRequest | null;
  readonly git: NextStepGit | null;
}

const SOL_LOOP = /\bsol[\s-]?loop\b/u;
/** An ask to merge this PR, as the Merge pill and the owner word it; not "don't merge yet". */
const MERGE = /\b(merge (it|this|the pr)|lets merge|let's merge)\b/u;
const NEGATED = /\b(don'?t|do not|not yet)\b/u;

/**
 * The next step, "hold" when the PR is the owner's call (watched, or a watch ended short of
 * mergeable) so nothing, learned or not, is offered, or null when no rule speaks.
 */
function resolveComposerNextStep(input: ComposerNextStepInput): ComposerNextStep | "hold" | null {
  const said = input.lastOwnerPrompt?.toLowerCase() ?? "";
  const pr = input.pullRequest;
  if (pr !== null) {
    if (pr.state === "merged") {
      return pr.releasable && MERGE.test(said) && !NEGATED.test(said) ? STEPS.release : null;
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

/** The thread's current PR, as the PR chip resolves it (a stack's top layer), for the next step. */
function nextStepPullRequestFromLinks(
  links: ReadonlyArray<ThreadPullRequestLink>,
): NextStepPullRequest | null {
  const link = resolveThreadCurrentPullRequestLink(links);
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
    releasable: isReleaseRepository(link.url),
  };
}

/** A PR the agent opened without linking it to the thread. Nothing watches it, and its checks
    are unknown. */
function unlinkedPullRequest(url: string): NextStepPullRequest {
  return {
    state: "open",
    watching: false,
    watchedBefore: false,
    ready: false,
    releasable: isReleaseRepository(url),
  };
}

interface BranchPullRequest {
  readonly state: "open" | "closed" | "merged" | null;
  readonly url: string;
}

/** The slice of a checkout's git status (VcsStatusResult) the next step reads. */
export interface NextStepGitStatus {
  readonly isRepo: boolean;
  readonly refName: string | null;
  readonly isDefaultRef: boolean;
  readonly hasPrimaryRemote: boolean;
  readonly hasWorkingTreeChanges: boolean;
  readonly aheadOfDefaultCount?: number | undefined;
  readonly pr: BranchPullRequest | null;
}

export interface PickedComposerNextStep {
  /** A rule's step, or "learned" for a habit. */
  readonly kind: ComposerNextStepKind | "learned";
  readonly label: string;
  readonly prompt: string;
  /** The learned habit, which the owner can dismiss. */
  readonly habit: HabitSuggestion | null;
}

/**
 * The thread's next step, ruled or learned, or null for none. The PR is the thread's linked one,
 * else an open one on its branch that the client already knows or git status finds; an old one
 * on a reused branch is not this work.
 */
export function pickComposerNextStep(input: {
  /** The owner's latest typed message, or null when none is loaded. */
  readonly lastOwnerPrompt: string | null;
  readonly links: ReadonlyArray<ThreadPullRequestLink>;
  readonly branch: string | null;
  readonly branchPullRequest: BranchPullRequest | null;
  readonly gitStatus: NextStepGitStatus | null;
  readonly habit: HabitSuggestion | null;
}): PickedComposerNextStep | null {
  const status = input.gitStatus;
  // A checkout on another branch is not this thread's work.
  const git =
    status === null || !status.isRepo || (input.branch !== null && status.refName !== input.branch)
      ? null
      : status;
  const unlinked = [input.branchPullRequest, input.branch === null ? null : git?.pr].find(
    (pr) => pr?.state === "open",
  );
  const step = resolveComposerNextStep({
    lastOwnerPrompt: input.lastOwnerPrompt,
    pullRequest:
      nextStepPullRequestFromLinks(input.links) ??
      (unlinked == null ? null : unlinkedPullRequest(unlinked.url)),
    git:
      git === null
        ? null
        : {
            isDefaultRef: git.isDefaultRef,
            hasPrimaryRemote: git.hasPrimaryRemote,
            hasWork: git.hasWorkingTreeChanges || (git.aheadOfDefaultCount ?? 0) > 0,
          },
  });
  if (step === "hold") return null;
  if (step !== null) return { ...step, habit: null };
  const { habit } = input;
  if (habit === null) return null;
  return {
    kind: "learned",
    label: habit.text.charAt(0).toUpperCase() + habit.text.slice(1),
    prompt: habit.text,
    habit,
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
