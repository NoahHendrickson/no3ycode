/**
 * A thread's open question or approval, answered from outside it — see `#fork-bot-digest`: Petal
 * digest cards and a sprint's inline cards share these. Only the card on show subscribes to its
 * thread's detail; upstream's createChildThreadApprovalsAtom would subscribe to every waiting one.
 */
import { useAtomValue } from "@effect/atom-react";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { thrownErrorMessage } from "@t3tools/client-runtime/errors";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import {
  buildPendingUserInputAnswers,
  togglePendingUserInputOptionSelection,
  type PendingUserInputDraftAnswer,
} from "@t3tools/client-runtime/state/pending-user-input";
import {
  type AtomCommandResult,
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import {
  seedUserInputDraftAnswers,
  userInputDraftKey,
} from "@t3tools/client-runtime/state/thread-requests";
import {
  AuthOrchestrationOperateScope,
  type ProviderApprovalDecision,
  type RuntimeRequestId,
} from "@t3tools/contracts";
import { msg } from "gt-react";
import { type ComponentProps, type ReactNode, useState } from "react";

import type { ComposerPendingUserInputPanel } from "~/components/chat/ComposerPendingUserInputPanel";
import { toastManager } from "~/components/ui/toast";
import { m } from "~/i18n/messages";
import { derivePendingUserInputProgress } from "~/pendingUserInput";
import {
  usePendingUserInputAnswers,
  usePendingUserInputQuestionIndex,
} from "~/questionAttachments";
import {
  derivePendingApprovals,
  derivePendingUserInputs,
  type PendingUserInput,
} from "~/session-logic";
import { useEnvironmentScope } from "~/state/session";
import { environmentThreadDetails, threadEnvironment } from "~/state/threads";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";

import { forkApprovalNoticeItem } from "./forkApprovalNotice";

const NO_ANSWERS: Record<string, PendingUserInputDraftAnswer> = {};

/** Sends one request's answer at a time; a failure toasts under `failureTitle`, an interrupt not. */
function useOneResponse() {
  const [responding, setResponding] = useState<RuntimeRequestId | null>(null);
  const run = async <A, E>(
    requestId: RuntimeRequestId,
    send: () => Promise<AtomCommandResult<A, E>>,
    failureTitle: string,
  ) => {
    if (responding !== null) return undefined;
    setResponding(requestId);
    const result = await send();
    setResponding(null);
    if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
      toastManager.add({
        type: "error",
        title: failureTitle,
        description: thrownErrorMessage(squashAtomCommandFailure(result), m) ?? undefined,
      });
    }
    return result;
  };
  return { responding, run };
}

type QuestionPanelProps = Omit<
  ComponentProps<typeof ComposerPendingUserInputPanel>,
  "footer" | "afterOptions" | "afterActions"
>;

export interface ChildQuestionControls {
  readonly input: PendingUserInput;
  /** The question on show. */
  readonly question: PendingUserInput["questions"][number] | undefined;
  /** The thread's drafts, seeded with each question's initial answer. */
  readonly answers: Record<string, PendingUserInputDraftAnswer>;
  readonly canAnswer: boolean;
  readonly setDraft: (questionId: string, next: PendingUserInputDraftAnswer) => void;
  /** Next question, or Submit on the last. */
  readonly advance: () => void;
  /** Everything the Questions panel takes but its footer and slots. */
  readonly panel: QuestionPanelProps;
}

/** The open request a card names, or the thread's first when it names none. */
export function pendingRequestFor<T extends { readonly requestId: RuntimeRequestId }>(
  pending: ReadonlyArray<T>,
  requestId: RuntimeRequestId | undefined,
): T | undefined {
  return requestId === undefined
    ? pending[0]
    : pending.find((entry) => entry.requestId === requestId);
}

/** Whether the thread still waits on `requestId`; null while its requests load. */
export function useChildRequestPending(
  child: Pick<EnvironmentThreadShell, "environmentId" | "id">,
  requestId: RuntimeRequestId,
): boolean | null {
  const requests = useAtomValue(
    environmentThreadDetails.pendingRequestsAtom(scopeThreadRef(child.environmentId, child.id)),
  );
  if (requests === null) return null;
  return [...requests.userInputs, ...requests.approvals].some(
    (entry) => entry.requestId === requestId,
  );
}

/** The thread's open question `requestId`, or its first, answered from here; null while it has
    none (or it loads). */
export function useChildQuestion(
  child: EnvironmentThreadShell,
  onAnswered?: (
    input: PendingUserInput,
    answers: NonNullable<ReturnType<typeof buildPendingUserInputAnswers>>,
  ) => void,
  requestId?: RuntimeRequestId,
): ChildQuestionControls | null {
  const ref = scopeThreadRef(child.environmentId, child.id);
  const requests = useAtomValue(environmentThreadDetails.pendingRequestsAtom(ref));
  const canOperate = useEnvironmentScope(child.environmentId, AuthOrchestrationOperateScope);
  const respond = useOrchestrationCommand(threadEnvironment.respondToUserInput, {
    reportFailure: false,
  });
  const dismiss = useOrchestrationCommand(threadEnvironment.dismissUserInput, {
    reportFailure: false,
  });
  const { responding, run } = useOneResponse();
  const input =
    requests === null || requests.userInputs.length === 0
      ? undefined
      : pendingRequestFor(derivePendingUserInputs(requests.userInputs), requestId);
  // The thread's own drafts, so a pick made here is there when the thread opens, and back here.
  const draftKey = userInputDraftKey(child.environmentId, child.id, input?.requestId);
  const stored = usePendingUserInputAnswers((state) => state[draftKey] ?? NO_ANSWERS);
  const index = usePendingUserInputQuestionIndex((state) => state[draftKey] ?? 0);
  if (input === undefined) return null;
  const answers: Record<string, PendingUserInputDraftAnswer> = seedUserInputDraftAnswers(
    input.questions,
    stored,
  );
  // As in the thread: a request whose provider turn is gone cannot be answered.
  const canAnswer = canOperate && input.responseCapability !== "not_resumable";
  const setIndex = (next: number) =>
    usePendingUserInputQuestionIndex.setState((existing) => ({ ...existing, [draftKey]: next }));
  const setDraft = (questionId: string, next: PendingUserInputDraftAnswer) =>
    usePendingUserInputAnswers.setState((existing) => ({
      ...existing,
      [draftKey]: { ...existing[draftKey], [questionId]: next },
    }));
  const submit = () => {
    const resolved = buildPendingUserInputAnswers(input.questions, answers);
    if (resolved === null || !canAnswer) return;
    void run(
      input.requestId,
      () =>
        respond({
          environmentId: child.environmentId,
          input: { threadId: child.id, requestId: input.requestId, answers: resolved },
        }),
      m(msg("Failed to submit user input.")),
    ).then((result) => {
      if (result?._tag === "Success") onAnswered?.(input, resolved);
    });
  };
  const advance = () => {
    const progress = derivePendingUserInputProgress(input.questions, answers, index);
    if (progress.isLastQuestion) submit();
    else if (progress.canAdvance) setIndex(index + 1);
  };
  return {
    input,
    question: input.questions[index],
    answers,
    canAnswer,
    setDraft,
    advance,
    panel: {
      pendingUserInputs: [input],
      cwd: child.worktreePath ?? undefined,
      threadRef: ref,
      disabled: !canAnswer,
      respondingRequestIds: responding === null ? [] : [responding],
      answers,
      questionIndex: index,
      numberKeys: false,
      onToggleOption: (questionId, optionValue) => {
        const question = input.questions.find((entry) => entry.id === questionId);
        if (question === undefined) return;
        usePendingUserInputAnswers.setState((existing) => ({
          ...existing,
          [draftKey]: {
            ...existing[draftKey],
            [questionId]: togglePendingUserInputOptionSelection(
              question,
              existing[draftKey]?.[questionId],
              optionValue,
            ),
          },
        }));
      },
      onAdvance: advance,
      onPrevious: () => setIndex(Math.max(0, index - 1)),
      onDismiss: (requestId) => {
        if (!canOperate) return;
        void run(
          requestId,
          () =>
            dismiss({
              environmentId: child.environmentId,
              input: { threadId: child.id, requestId },
            }),
          m(msg("Failed to dismiss the question.")),
        );
      },
    },
  };
}

export interface ChildApprovalControls {
  readonly approval: ReturnType<typeof derivePendingApprovals>[number];
  /** The approval notice; `source` sits beside its buttons. */
  readonly notice: (source?: ReactNode) => ReturnType<typeof forkApprovalNoticeItem>;
}

/** The thread's open approval `requestId`, or its first, decided from here; null while it has
    none (or it loads). */
export function useChildApproval(
  child: EnvironmentThreadShell,
  onAnswered?: (
    approval: ChildApprovalControls["approval"],
    decision: ProviderApprovalDecision,
  ) => void,
  requestId?: RuntimeRequestId,
): ChildApprovalControls | null {
  const ref = scopeThreadRef(child.environmentId, child.id);
  const requests = useAtomValue(environmentThreadDetails.pendingRequestsAtom(ref));
  const canOperate = useEnvironmentScope(child.environmentId, AuthOrchestrationOperateScope);
  const respond = useOrchestrationCommand(threadEnvironment.respondToApproval, {
    reportFailure: false,
  });
  const { responding, run } = useOneResponse();
  const approvals =
    requests === null || requests.approvals.length === 0
      ? []
      : derivePendingApprovals(requests.approvals);
  const approval = pendingRequestFor(approvals, requestId);
  if (approval === undefined) return null;
  const onRespondToApproval = async (
    requestId: RuntimeRequestId,
    decision: ProviderApprovalDecision,
  ) => {
    const result = await run(
      requestId,
      () =>
        respond({
          environmentId: child.environmentId,
          input: { threadId: child.id, requestId, decision },
        }),
      m(msg("Failed to submit approval decision.")),
    );
    if (result?._tag === "Success") {
      onAnswered?.(approvals.find((entry) => entry.requestId === requestId) ?? approval, decision);
    }
    return result;
  };
  return {
    approval,
    notice: (source) =>
      forkApprovalNoticeItem({
        approval,
        pendingCount: approvals.length,
        disabled: !canOperate,
        isResponding: responding === approval.requestId,
        onRespondToApproval,
        aside: true,
        ...(source === undefined ? {} : { source }),
      }),
  };
}
