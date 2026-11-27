/**
 * A Petal's work threads' questions and approvals as the thread's own cards — see
 * `.fork/customizations.yaml#fork-bot-digest`. Only the card on show subscribes to its thread's
 * detail; upstream's createChildThreadApprovalsAtom would subscribe to every waiting one.
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
import { useState } from "react";

import { ComposerBannerStack } from "~/components/chat/ComposerBannerStack";
import { ComposerPendingUserInputPanel } from "~/components/chat/ComposerPendingUserInputPanel";
import { toastManager } from "~/components/ui/toast";
import { m } from "~/i18n/messages";
import { derivePendingUserInputProgress } from "~/pendingUserInput";
import {
  usePendingUserInputAnswers,
  usePendingUserInputQuestionIndex,
} from "~/questionAttachments";
import { derivePendingApprovals, derivePendingUserInputs } from "~/session-logic";
import { useEnvironmentScope } from "~/state/session";
import { environmentThreadDetails, threadEnvironment } from "~/state/threads";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";

import { ForkQuestionCard } from "../ForkQuestionCard";
import { forkApprovalNoticeItem } from "../forkApprovalNotice";
import {
  BotDigestBanner,
  BotDigestBottom,
  BotDigestBottomInline,
  type BotDigestBottomState,
} from "./BotDigestBottom";
import { childLinks } from "./BotDigestItem";

const NO_ANSWERS: Record<string, PendingUserInputDraftAnswer> = {};

/** Sends one request's answer at a time; a failure toasts under `failureTitle`. */
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

/** The thread's card without its request: while it loads (or the shell's flag runs ahead of it),
    so the card the pager is on never vanishes, or when only the thread can answer it. */
function ChildNote(props: {
  readonly child: EnvironmentThreadShell;
  readonly bottom: BotDigestBottomState;
  readonly note: string;
}) {
  const { child } = props;
  return (
    <BotDigestBanner>
      <ForkQuestionCard
        question={<p className="text-muted-foreground">{props.note}</p>}
        footer={
          <BotDigestBottom
            {...props.bottom}
            links={childLinks(child)}
            environmentId={child.environmentId}
          />
        }
      />
    </BotDigestBanner>
  );
}

/** @public — a work thread's question as its Questions card. */
export function BotChildQuestion(props: {
  readonly child: EnvironmentThreadShell;
  readonly bottom: BotDigestBottomState;
}) {
  const { child } = props;
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
      : derivePendingUserInputs(requests.userInputs)[0];
  // The thread's own drafts, so a pick made here is there when the thread opens, and back here.
  const draftKey = userInputDraftKey(child.environmentId, child.id, input?.requestId);
  const stored = usePendingUserInputAnswers((state) => state[draftKey] ?? NO_ANSWERS);
  const index = usePendingUserInputQuestionIndex((state) => state[draftKey] ?? 0);
  if (input === undefined) {
    return (
      <ChildNote child={child} bottom={props.bottom} note={`${child.title} is waiting on you.`} />
    );
  }
  // Typed words are the thread composer's; this one talks to the Petal.
  if (input.questions.some((question) => question.options.length === 0)) {
    return (
      <ChildNote
        child={child}
        bottom={props.bottom}
        note="This question needs a typed answer. Open the thread to answer it."
      />
    );
  }
  const answers: Record<string, PendingUserInputDraftAnswer> = seedUserInputDraftAnswers(
    input.questions,
    stored,
  );
  // As in the thread: a request whose provider turn is gone cannot be answered.
  const canAnswer = canOperate && input.responseCapability !== "not_resumable";
  const setIndex = (next: number) =>
    usePendingUserInputQuestionIndex.setState((existing) => ({ ...existing, [draftKey]: next }));
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
    );
  };
  return (
    <BotDigestBanner>
      <ComposerPendingUserInputPanel
        pendingUserInputs={[input]}
        cwd={child.worktreePath ?? undefined}
        threadRef={ref}
        disabled={!canAnswer}
        respondingRequestIds={responding === null ? [] : [responding]}
        answers={answers}
        questionIndex={index}
        numberKeys={false}
        onToggleOption={(questionId, optionValue) => {
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
        }}
        onAdvance={() => {
          const progress = derivePendingUserInputProgress(input.questions, answers, index);
          if (progress.isLastQuestion) submit();
          else if (progress.canAdvance) setIndex(index + 1);
        }}
        onPrevious={() => setIndex(Math.max(0, index - 1))}
        onDismiss={(requestId) => {
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
        }}
        footer={
          <BotDigestBottom
            {...props.bottom}
            links={childLinks(child)}
            environmentId={child.environmentId}
          />
        }
      />
    </BotDigestBanner>
  );
}

/** @public — a work thread's approval as its approval notice. */
export function BotChildApproval(props: {
  readonly child: EnvironmentThreadShell;
  readonly bottom: BotDigestBottomState;
}) {
  const { child } = props;
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
  const approval = approvals[0];
  if (approval === undefined) {
    return (
      <ChildNote child={child} bottom={props.bottom} note={`${child.title} is waiting on you.`} />
    );
  }
  const onRespondToApproval = (requestId: RuntimeRequestId, decision: ProviderApprovalDecision) =>
    run(
      requestId,
      () =>
        respond({
          environmentId: child.environmentId,
          input: { threadId: child.id, requestId, decision },
        }),
      m(msg("Failed to submit approval decision.")),
    );
  return (
    <ComposerBannerStack
      items={[
        forkApprovalNoticeItem({
          approval,
          pendingCount: approvals.length,
          disabled: !canOperate,
          isResponding: responding === approval.requestId,
          onRespondToApproval,
          aside: true,
          source: (
            <BotDigestBottomInline
              {...props.bottom}
              links={childLinks(child)}
              environmentId={child.environmentId}
            />
          ),
        }),
      ]}
    />
  );
}
