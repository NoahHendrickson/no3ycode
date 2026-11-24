/**
 * The thread's next step for the no3y pill row, picked as on web (client-runtime
 * pickComposerNextStep). See `.fork/customizations.yaml#fork-composer-next-step`.
 */
import { useAtomValue } from "@effect/atom-react";
import {
  lastOwnerPrompt,
  pickComposerNextStep,
  type PickedComposerNextStep,
} from "@t3tools/client-runtime/fork-composer-next-step";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { useState } from "react";

import type { PendingThreadFeedEntry } from "../src/features/threads/pending-thread-feed";
import { composerDraftsAtom } from "../src/state/use-composer-drafts";
import { useQuietThreadStructure } from "../src/state/use-thread-detail";
import type { ThreadPrPresentation } from "../src/state/use-thread-pr";
import { useEnvironmentQuery } from "../src/state/query";
import { vcsEnvironment } from "../src/state/vcs";
import { useNo3yComposerHabitSuggestion } from "./no3yComposerHabits";

/** The slice of ThreadDetailScreen's props the pill's gate and inputs read. */
export interface No3yNextStepScreen {
  readonly selectedThread: EnvironmentThreadShell;
  readonly selectedThreadDetailRef: ScopedThreadRef | null;
  readonly selectedThreadFeed: ReadonlyArray<PendingThreadFeedEntry>;
  readonly selectedThreadQueueCount: number;
  readonly threadCwd: string | null;
  readonly composerDraftKey: string | null;
  readonly canOperateThread: boolean;
  readonly creationState: unknown;
  readonly activeThreadBusy: boolean;
  readonly activePendingApproval: unknown;
  readonly activePendingUserInput: unknown;
  readonly runlessWorkActive?: boolean | undefined;
  readonly isCompacting: boolean;
}

/**
 * The latest run completed and nothing waits on, or is on its way to, the owner: no approval,
 * question or link request, no runless work or compaction, nothing queued on the server or in the
 * outbox, and no sent message the thread has not caught up to (it stays at the feed's end).
 */
export function no3yNextStepSettled(
  screen: No3yNextStepScreen,
  extra: { readonly feedReady: boolean; readonly serverQueueCount: number },
): boolean {
  const thread = screen.selectedThread;
  const tail = screen.selectedThreadFeed.at(-1);
  return (
    extra.feedReady &&
    extra.serverQueueCount === 0 &&
    thread.lineage.sideChat !== true &&
    thread.latestRun?.status === "completed" &&
    !thread.hasPendingUserInput &&
    screen.canOperateThread &&
    screen.creationState === null &&
    !screen.activeThreadBusy &&
    screen.activePendingApproval === null &&
    screen.activePendingUserInput === null &&
    screen.runlessWorkActive !== true &&
    !screen.isCompacting &&
    screen.selectedThreadQueueCount === 0 &&
    !(tail?.type === "message" && tail.pendingMessage !== undefined)
  );
}

export interface No3yNextStep {
  readonly step: PickedComposerNextStep | null;
  /** Sends the step through `dispatch` (the screen's owner send), hiding it until that settles. */
  readonly send: (dispatch: (prompt: string) => Promise<unknown>) => void;
}

export function useNo3yNextStep(input: {
  readonly screen: No3yNextStepScreen;
  /** The no3y layout is on and the screen is settled (no3yNextStepSettled). */
  readonly active: boolean;
  /** The pull request pill's own, for a pull request the agent opened without linking it. */
  readonly pullRequest: ThreadPrPresentation | null;
}): No3yNextStep {
  const { screen } = input;
  const [sending, setSending] = useState(false);
  const active = input.active && !sending;
  const messages = useQuietThreadStructure(active ? screen.selectedThreadDetailRef : null)
    ?.projection.messages;
  const previous = messages === undefined ? null : lastOwnerPrompt(messages);
  // A tap sends at once, so the pill waits for an empty composer rather than racing a draft.
  const draftKey = screen.composerDraftKey;
  const draftHasContent = useAtomValue(composerDraftsAtom, (drafts) => {
    const draft = draftKey === null ? undefined : drafts[draftKey];
    return (
      draft !== undefined &&
      (draft.text.trim().length > 0 || draft.attachments.length > 0 || draft.context !== undefined)
    );
  });
  const habit = useNo3yComposerHabitSuggestion(active ? previous : null);
  const thread = screen.selectedThread;
  const cwd = screen.threadCwd;
  const status = useEnvironmentQuery(
    active && cwd !== null
      ? vcsEnvironment.status({ environmentId: thread.environmentId, input: { cwd } })
      : null,
  ).data;
  const step =
    !active || draftHasContent || messages === undefined
      ? null
      : pickComposerNextStep({
          lastOwnerPrompt: previous,
          links: thread.pullRequests ?? [],
          branch: thread.branch,
          branchPullRequest: input.pullRequest,
          gitStatus: status ?? null,
          habit,
        });
  return {
    step,
    send: (dispatch) => {
      if (step === null) return;
      setSending(true);
      void dispatch(step.prompt).then(
        () => setSending(false),
        () => setSending(false),
      );
    },
  };
}
