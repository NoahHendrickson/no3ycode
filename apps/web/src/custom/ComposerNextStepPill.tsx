/** The thread's next step, ruled or learned, as a pill above the composer; a click sends it. See
    `.fork/customizations.yaml#fork-composer-next-step`. */
import { useAtomValue } from "@effect/atom-react";
import type { ThreadStructure } from "@t3tools/client-runtime/state/shell";
import type { EnvironmentId, ThreadPullRequestLink } from "@t3tools/contracts";
import * as Equal from "effect/Equal";
import { AsyncResult, Atom } from "effect/reactivity";
import { memo } from "react";

import { ComposerControl } from "~/components/chat/ComposerControl";
import {
  type ComposerThreadTarget,
  composerDraftHasUserContent,
  useComposerDraftStore,
} from "~/composerDraftStore";
import { vcsEnvironment } from "~/state/vcs";

import {
  type ComposerNextStepKind,
  type NextStepGitStatus,
  type NextStepPullRequest,
  nextStepPullRequestFromBranch,
  nextStepPullRequestFromLinks,
  lastOwnerPrompt,
  resolveComposerNextStep,
} from "./composerNextStep.logic";
import { forgetComposerHabit, useComposerHabitSuggestion } from "./composerHabits";
import {
  GitMergeIcon,
  GitPullRequestArrowIcon,
  EyeIcon,
  RocketIcon,
  SparklesIcon,
  XIcon,
} from "./icons/lucide-hugeicons";

const KIND_ICON: Record<ComposerNextStepKind, typeof EyeIcon> = {
  "open-pr": GitPullRequestArrowIcon,
  babysit: EyeIcon,
  merge: GitMergeIcon,
  release: RocketIcon,
};

interface NextStepCheckout {
  readonly git: NextStepGitStatus;
  readonly branchPullRequest: NextStepPullRequest | null;
}

/** Only what the next step reads, so a file edit that keeps the counts doesn't re-render. */
const nextStepCheckoutAtom = Atom.family((status: ReturnType<typeof vcsEnvironment.status>) =>
  Atom.map(status, (result): NextStepCheckout | null => {
    const data = AsyncResult.getOrElse(result, () => null);
    if (data === null || !data.isRepo) return null;
    return {
      git: {
        isDefaultRef: data.isDefaultRef,
        hasPrimaryRemote: data.hasPrimaryRemote,
        hasWork: data.hasWorkingTreeChanges || (data.aheadOfDefaultCount ?? 0) > 0,
      },
      branchPullRequest: nextStepPullRequestFromBranch(data.pr),
    };
  }).pipe(Atom.withEquality(Equal.equals)),
);
const NO_CHECKOUT_ATOM = Atom.make<NextStepCheckout | null>(null);

export const ComposerNextStepPill = memo(function ComposerNextStepPill(props: {
  readonly environmentId: EnvironmentId;
  /** ChatView's git-status cwd. */
  readonly cwd: string | null;
  /** The latest run completed and nothing waits on the owner. */
  readonly settled: boolean;
  readonly pullRequests: ReadonlyArray<ThreadPullRequestLink>;
  readonly messages: ThreadStructure["messages"] | null;
  readonly draftTarget: ComposerThreadTarget;
  readonly onSend: (prompt: string) => void;
}) {
  const checkout = useAtomValue(
    props.cwd === null
      ? NO_CHECKOUT_ATOM
      : nextStepCheckoutAtom(
          vcsEnvironment.status({ environmentId: props.environmentId, input: { cwd: props.cwd } }),
        ),
  );
  // A click sends at once, so it waits for an empty composer rather than racing what's written.
  const draftHasContent = useComposerDraftStore((store) =>
    composerDraftHasUserContent(store.getComposerDraft(props.draftTarget)),
  );
  const previous = props.messages === null ? null : lastOwnerPrompt(props.messages);
  const habit = useComposerHabitSuggestion(previous);
  if (!props.settled || draftHasContent || props.messages === null) return null;
  const step = resolveComposerNextStep({
    lastOwnerPrompt: previous,
    pullRequest:
      nextStepPullRequestFromLinks(props.pullRequests) ?? checkout?.branchPullRequest ?? null,
    git: checkout?.git ?? null,
  });
  if (step === "hold") return null;
  if (step === null) {
    if (habit === null) return null;
    return (
      <span
        data-fork-composer-status-chip="learned-step"
        className="inline-flex min-w-0 items-center"
      >
        <ComposerControl
          size="xs"
          data-fork-status-chip-main=""
          title={`You usually send this next. Send "${habit.text}"`}
          onClick={() => props.onSend(habit.text)}
        >
          <SparklesIcon aria-hidden />
          <span className="max-w-64 truncate">{sentenceCase(habit.text)}</span>
        </ComposerControl>
        <ComposerControl
          size="xs"
          data-fork-status-chip-stop=""
          aria-label="Stop suggesting this"
          title="Stop suggesting this"
          onClick={() => forgetComposerHabit(habit)}
        >
          <XIcon aria-hidden />
        </ComposerControl>
      </span>
    );
  }
  const Icon = KIND_ICON[step.kind];
  return (
    <ComposerControl
      size="xs"
      data-fork-composer-status-chip="next-step"
      data-fork-next-step={step.kind}
      title={`Send "${step.prompt}"`}
      onClick={() => props.onSend(step.prompt)}
    >
      <Icon aria-hidden />
      {step.label}
    </ComposerControl>
  );
});

const sentenceCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
