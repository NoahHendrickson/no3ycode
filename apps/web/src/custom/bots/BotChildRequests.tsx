/**
 * A Petal's work threads' questions and approvals, paged with its digest's asks above its composer
 * — see `.fork/customizations.yaml#fork-bot-digest`. Each is the card the thread itself would
 * show, with the thread named underneath, answered here with the same commands the thread uses.
 */
import { useAtomValue } from "@effect/atom-react";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import {
  buildPendingUserInputAnswers,
  togglePendingUserInputOptionSelection,
  type PendingUserInputDraftAnswer,
} from "@t3tools/client-runtime/state/pending-user-input";
import { seedUserInputDraftAnswers } from "@t3tools/client-runtime/state/thread-requests";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import {
  AuthOrchestrationOperateScope,
  type ProviderApprovalDecision,
  type RuntimeRequestId,
} from "@t3tools/contracts";
import { msg } from "gt-react";
import { useState } from "react";

import { ComposerBanner } from "~/components/chat/ComposerBanner";
import { ComposerBannerStack } from "~/components/chat/ComposerBannerStack";
import { ComposerPendingUserInputPanel } from "~/components/chat/ComposerPendingUserInputPanel";
import { toastManager } from "~/components/ui/toast";
import { m } from "~/i18n/messages";
import { derivePendingUserInputProgress } from "~/pendingUserInput";
import { derivePendingApprovals, derivePendingUserInputs } from "~/session-logic";
import { useEnvironmentScope } from "~/state/session";
import { environmentThreadDetails, threadEnvironment } from "~/state/threads";
import { useAtomCommand } from "~/state/use-atom-command";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";

import { forkApprovalNoticeItem } from "../forkApprovalNotice";
import { type BotDigestBottomState, BotDigestBottom } from "./BotDigestBottom";
import { BotDigestLinkRow } from "./BotDigestItem";

const NO_ANSWERS: Record<string, PendingUserInputDraftAnswer> = {};

/** The thread a request came from, as the digest names a thread it links. */
function ChildSource(props: { readonly child: EnvironmentThreadShell }) {
  const { child } = props;
  return (
    <BotDigestLinkRow
      environmentId={child.environmentId}
      links={{
        threads: [
          {
            link: { environmentId: child.environmentId, threadId: child.id },
            label: child.title,
            shell: child,
          },
        ],
        pullRequests: [],
      }}
    />
  );
}

/** While the thread's request loads (or the shell's flag runs ahead of it), so the card the
    pager is on never vanishes from under it. */
function ChildPlaceholder(props: {
  readonly child: EnvironmentThreadShell;
  readonly bottom: BotDigestBottomState;
}) {
  return (
    <ComposerBanner.Attachment data-fork-composer-aside="true">
      <ComposerBanner.Root data-chat-composer-top-drawer="true" variant="info">
        <div data-fork-pending-user-input="true" className="flex flex-col">
          <p className="px-4 py-3 text-sm text-muted-foreground">
            {props.child.title} is waiting on you.
          </p>
          <BotDigestBottom
            {...props.bottom}
            links={<ChildSource child={props.child} />}
            hasLinks
            ruled
          />
        </div>
      </ComposerBanner.Root>
    </ComposerBanner.Attachment>
  );
}

function failureMessage(result: unknown) {
  const failure = squashAtomCommandFailure(result as never);
  return failure instanceof Error ? failure.message : undefined;
}

/** @public — a work thread's question as its Questions card. Only mounted while it is the card
    on show, so only then is the thread's detail subscribed to. */
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
  const dismiss = useAtomCommand(threadEnvironment.dismissUserInput, { reportFailure: false });
  const [answersByRequest, setAnswersByRequest] = useState<
    Record<string, Record<string, PendingUserInputDraftAnswer>>
  >({});
  const [indexByRequest, setIndexByRequest] = useState<Record<string, number>>({});
  const [responding, setResponding] = useState<RuntimeRequestId | null>(null);
  const input =
    requests === null || requests.userInputs.length === 0
      ? undefined
      : derivePendingUserInputs(requests.userInputs)[0];
  if (input === undefined) return <ChildPlaceholder child={child} bottom={props.bottom} />;
  const answers = seedUserInputDraftAnswers(
    input.questions,
    answersByRequest[input.requestId] ?? NO_ANSWERS,
  ) as Record<string, PendingUserInputDraftAnswer>;
  const index = indexByRequest[input.requestId] ?? 0;
  // As in the thread: a request whose provider turn is gone cannot be answered.
  const canAnswer = canOperate && input.responseCapability !== "not_resumable";
  const setIndex = (next: number) =>
    setIndexByRequest((existing) => ({ ...existing, [input.requestId]: next }));
  const dismissQuestion = async (requestId: RuntimeRequestId) => {
    if (!canOperate || responding !== null) return;
    setResponding(requestId);
    const result = await dismiss({
      environmentId: child.environmentId,
      input: { threadId: child.id, requestId },
    });
    setResponding(null);
    if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
      toastManager.add({
        type: "error",
        title: m(msg("Failed to dismiss the question.")),
        description: failureMessage(result),
      });
    }
  };
  const submit = async () => {
    const resolved = buildPendingUserInputAnswers(input.questions, answers);
    if (resolved === null || responding !== null || !canAnswer) return;
    setResponding(input.requestId);
    const result = await respond({
      environmentId: child.environmentId,
      input: { threadId: child.id, requestId: input.requestId, answers: resolved },
    });
    setResponding(null);
    if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
      toastManager.add({
        type: "error",
        title: m(msg("Failed to submit user input.")),
        description: failureMessage(result),
      });
    }
  };
  return (
    <ComposerBanner.Attachment data-fork-composer-aside="true">
      <ComposerBanner.Root data-chat-composer-top-drawer="true" variant="info">
        <ComposerPendingUserInputPanel
          pendingUserInputs={[input]}
          cwd={child.worktreePath ?? undefined}
          threadRef={ref}
          disabled={!canAnswer}
          respondingRequestIds={responding === null ? [] : [responding]}
          answers={answers}
          questionIndex={index}
          onToggleOption={(questionId, optionValue) => {
            const question = input.questions.find((entry) => entry.id === questionId);
            if (question === undefined) return;
            setAnswersByRequest((existing) => {
              const forRequest = existing[input.requestId] ?? NO_ANSWERS;
              return {
                ...existing,
                [input.requestId]: {
                  ...forRequest,
                  [questionId]: togglePendingUserInputOptionSelection(
                    question,
                    forRequest[questionId],
                    optionValue,
                  ),
                },
              };
            });
          }}
          onAdvance={() => {
            const progress = derivePendingUserInputProgress(input.questions, answers, index);
            if (progress.isLastQuestion) void submit();
            else if (progress.canAdvance) setIndex(index + 1);
          }}
          onPrevious={() => setIndex(Math.max(0, index - 1))}
          onDismiss={(requestId) => void dismissQuestion(requestId)}
          footer={
            <BotDigestBottom
              {...props.bottom}
              links={<ChildSource child={child} />}
              hasLinks
              ruled
            />
          }
        />
      </ComposerBanner.Root>
    </ComposerBanner.Attachment>
  );
}

/** @public — a work thread's approval as its approval notice. Only mounted while it is the card
    on show, so only then is the thread's detail subscribed to. */
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
  const [responding, setResponding] = useState<RuntimeRequestId | null>(null);
  const approvals =
    requests === null || requests.approvals.length === 0
      ? []
      : derivePendingApprovals(requests.approvals);
  const approval = approvals[0];
  if (approval === undefined) return <ChildPlaceholder child={child} bottom={props.bottom} />;
  const onRespondToApproval = async (
    requestId: RuntimeRequestId,
    decision: ProviderApprovalDecision,
  ) => {
    if (responding !== null) return;
    setResponding(requestId);
    const result = await respond({
      environmentId: child.environmentId,
      input: { threadId: child.id, requestId, decision },
    });
    setResponding(null);
    if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
      toastManager.add({
        type: "error",
        title: m(msg("Failed to submit approval decision.")),
        description: failureMessage(result),
      });
    }
    return result;
  };
  return (
    <ComposerBannerStack
      items={[
        forkApprovalNoticeItem({
          approval,
          pendingCount: approvals.length,
          disabled: !canOperate,
          isResponding: responding === approval.requestId,
          onRespondToApproval,
          source: (
            <BotDigestBottom
              {...props.bottom}
              links={<ChildSource child={child} />}
              hasLinks
              ruled={false}
            />
          ),
        }),
      ]}
    />
  );
}
