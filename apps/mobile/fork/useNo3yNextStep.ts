/**
 * The thread's next step for the no3y pill row, ruled or learned, as the web's
 * ComposerNextStepPill picks it. See `.fork/customizations.yaml#fork-composer-next-step`.
 */
import { useAtomValue } from "@effect/atom-react";
import type { HabitSuggestion } from "@t3tools/client-runtime/fork-composer-habits";
import {
  type ComposerNextStepKind,
  lastOwnerPrompt,
  nextStepPullRequestFromBranch,
  nextStepPullRequestFromLinks,
  resolveComposerNextStep,
} from "@t3tools/client-runtime/fork-composer-next-step";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import type { ScopedThreadRef } from "@t3tools/contracts";

import { composerDraftsAtom } from "../src/state/use-composer-drafts";
import { useQuietThreadStructure } from "../src/state/use-thread-detail";
import type { ThreadPrPresentation } from "../src/state/use-thread-pr";
import { useEnvironmentQuery } from "../src/state/query";
import { vcsEnvironment } from "../src/state/vcs";
import { useNo3yComposerHabitSuggestion } from "./no3yComposerHabits";

export interface No3yNextStep {
  /** A rule's step, or "learned" for a habit, which the owner can dismiss. */
  readonly kind: ComposerNextStepKind | "learned";
  readonly label: string;
  readonly prompt: string;
  readonly habit: HabitSuggestion | null;
  /** The owner's message this step follows, which a send of it is learned against. */
  readonly previous: string | null;
}

export function useNo3yNextStep(input: {
  readonly enabled: boolean;
  /** The latest run completed and nothing waits on the owner. */
  readonly settled: boolean;
  readonly thread: EnvironmentThreadShell;
  readonly detailRef: ScopedThreadRef | null;
  readonly cwd: string | null;
  readonly draftKey: string | null;
  /** The pull request pill's own, for a pull request the agent opened without linking it. */
  readonly pullRequest: ThreadPrPresentation | null;
}): No3yNextStep | null {
  const active = input.enabled && input.settled;
  const messages = useQuietThreadStructure(active ? input.detailRef : null)?.projection.messages;
  const previous = messages === undefined ? null : lastOwnerPrompt(messages);
  // A tap sends at once, so the pill waits for an empty composer rather than racing a draft, and
  // for no armed fresh session, which a tap's plain send would skip.
  const draftKey = input.draftKey;
  const draftHasContent = useAtomValue(composerDraftsAtom, (drafts) => {
    const draft = draftKey === null ? undefined : drafts[draftKey];
    return (
      draft !== undefined &&
      (draft.text.trim().length > 0 ||
        draft.attachments.length > 0 ||
        draft.context !== undefined ||
        draft.freshContext === true)
    );
  });
  const habit = useNo3yComposerHabitSuggestion(active ? previous : null);
  // Unlinked, only an open PR counts, as on web: an old one on a reused branch is not this work.
  const branchPullRequest = input.pullRequest;
  const pullRequest =
    nextStepPullRequestFromLinks(input.thread.pullRequests ?? []) ??
    (branchPullRequest?.state === "open"
      ? nextStepPullRequestFromBranch({ state: "open", url: branchPullRequest.url })
      : null);
  // Git status finds a pull request the thread does not know yet, and decides Open PR.
  const status = useEnvironmentQuery(
    active && pullRequest === null && input.cwd !== null
      ? vcsEnvironment.status({
          environmentId: input.thread.environmentId,
          input: { cwd: input.cwd },
        })
      : null,
  ).data;
  if (!active || draftHasContent || messages === undefined) return null;
  // A checkout on another branch is not this thread's work.
  const git =
    status == null ||
    !status.isRepo ||
    (input.thread.branch !== null && status.refName !== input.thread.branch)
      ? null
      : status;
  const step = resolveComposerNextStep({
    lastOwnerPrompt: previous,
    // As web's resolveDisplayedThreadPr: an open PR on the thread's own branch, not an old one.
    pullRequest:
      pullRequest ??
      nextStepPullRequestFromBranch(
        input.thread.branch !== null && git?.pr?.state === "open" ? git.pr : null,
      ),
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
  if (step !== null) return { ...step, habit: null, previous };
  if (habit === null) return null;
  return {
    kind: "learned",
    label: habit.text.charAt(0).toUpperCase() + habit.text.slice(1),
    prompt: habit.text,
    habit,
    previous,
  };
}
