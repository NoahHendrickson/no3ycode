/** The thread's next step, ruled or learned, as a pill above the composer; a click sends it. See
    `.fork/customizations.yaml#fork-composer-next-step`. */
import type { ThreadStructure } from "@t3tools/client-runtime/state/shell";
import type { EnvironmentId, ThreadPullRequestLink } from "@t3tools/contracts";
import { memo } from "react";

import { ComposerControl } from "~/components/chat/ComposerControl";
import { resolveDisplayedThreadPr } from "~/components/ThreadStatusIndicators";
import {
  type ComposerThreadTarget,
  composerDraftHasUserContent,
  useComposerDraftStore,
} from "~/composerDraftStore";
import { useEnvironmentQuery } from "~/state/query";
import { vcsEnvironment } from "~/state/vcs";

import {
  type ComposerNextStepKind,
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

export const ComposerNextStepPill = memo(function ComposerNextStepPill(props: {
  readonly environmentId: EnvironmentId;
  /** ChatView's git-status cwd, null when the checkout is on another branch than the thread. */
  readonly cwd: string | null;
  readonly branch: string | null;
  /** The latest run completed and nothing waits on the owner. */
  readonly settled: boolean;
  readonly pullRequests: ReadonlyArray<ThreadPullRequestLink>;
  readonly messages: ThreadStructure["messages"] | null;
  readonly draftTarget: ComposerThreadTarget;
  readonly onSend: (prompt: string) => void;
}) {
  // The PR chip beside it reads this same status, so the two resolve the thread's PR alike.
  const status = useEnvironmentQuery(
    props.cwd === null
      ? null
      : vcsEnvironment.status({ environmentId: props.environmentId, input: { cwd: props.cwd } }),
  ).data;
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
      nextStepPullRequestFromLinks(props.pullRequests) ??
      nextStepPullRequestFromBranch(
        resolveDisplayedThreadPr({ threadBranch: props.branch, gitStatus: status ?? null }),
      ),
    git:
      status == null || !status.isRepo
        ? null
        : {
            isDefaultRef: status.isDefaultRef,
            hasPrimaryRemote: status.hasPrimaryRemote,
            hasWork: status.hasWorkingTreeChanges || (status.aheadOfDefaultCount ?? 0) > 0,
          },
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
