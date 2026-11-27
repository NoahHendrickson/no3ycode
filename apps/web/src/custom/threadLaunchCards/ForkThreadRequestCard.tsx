/**
 * A thread's question or approval, answered from the conversation that started it — see
 * `.fork/customizations.yaml#fork-thread-launch-cards`. The thread's row heads a card with its arm
 * turned down; once answered, the card stays with the answer. An answer goes to the thread itself,
 * and a sprint also finds it in ANSWERS.md, shown to it on its next message like a panel edit.
 */
import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import {
  buildPendingUserInputAnswers,
  setPendingUserInputCustomAnswer,
  togglePendingUserInputOptionSelection,
  type PendingUserInputDraftAnswer,
} from "@t3tools/client-runtime/state/pending-user-input";
import { executeAtomQuery, runAtomCommand } from "@t3tools/client-runtime/state/runtime";
import {
  seedUserInputDraftAnswers,
  userInputDraftKey,
} from "@t3tools/client-runtime/state/thread-requests";
import {
  AuthOrchestrationOperateScope,
  type ProjectReadFileResult,
  type ProviderApprovalDecision,
  type RuntimeRequestId,
  type ScopedThreadRef,
} from "@t3tools/contracts";
import { AsyncResult, Atom } from "effect/reactivity";
import { type ReactNode, useContext, useState } from "react";

import { ComposerBannerStack } from "~/components/chat/ComposerBannerStack";
import { ComposerPendingUserInputPanel } from "~/components/chat/ComposerPendingUserInputPanel";
import { toastManager } from "~/components/ui/toast";
import { derivePendingUserInputProgress } from "~/pendingUserInput";
import {
  usePendingUserInputAnswers,
  usePendingUserInputQuestionIndex,
} from "~/questionAttachments";
import { derivePendingApprovals, derivePendingUserInputs } from "~/session-logic";
import { readThreadShell, useQuietThreadShell } from "~/state/entities";
import { projectEnvironment } from "~/state/projects";
import { useEnvironmentScope } from "~/state/session";
import { environmentThreadDetails, threadEnvironment } from "~/state/threads";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";

import { forkApprovalNoticeItem } from "../forkApprovalNotice";
import { CheckIcon } from "../icons/lucide-hugeicons";
import { isSprintThread, SPRINT_OWNER_EDITS_DIRECTORY } from "../sprints/sprintThreads";
import { ForkThreadHookRow, useOpenThreadBeside } from "./ForkThreadLaunchCards";
import {
  type SprintAnswer,
  sprintAnswerLine,
  sprintAnswersFor,
  withSprintAnswer,
} from "./threadLaunch.logic";

const NO_ANSWERS: Record<string, PendingUserInputDraftAnswer> = {};
const ANSWERS_FILE = "ANSWERS.md";
const QUIET = { reportFailure: false, reportDefect: true } as const;

/** Ruled into sections as the Questions card above the composer is; only the question is filled. */
const CARD =
  "max-w-xl overflow-hidden rounded-xl border border-border [&_[data-fork-pending-user-input-question]]:bg-card [&_[data-fork-pending-user-input-question]]:border-b [&_[data-fork-pending-user-input-question]]:border-border";

/** The sprint a conversation is, with its folder; null for any other conversation. */
function sprintFolder(shell: EnvironmentThreadShell | null) {
  return shell !== null && isSprintThread(shell.source) && shell.worktreePath !== null
    ? { environmentId: shell.environmentId, cwd: shell.worktreePath }
    : null;
}

/** Notes a direct answer in a sprint's ANSWERS.md and marks it changed; nothing for other hosts. */
function useNoteAnswer(hostRef: ScopedThreadRef | null) {
  const registry = useContext(RegistryContext);
  return async (thread: EnvironmentThreadShell, answers: ReadonlyArray<SprintAnswer>) => {
    const folder = sprintFolder(hostRef === null ? null : readThreadShell(hostRef));
    if (folder === null) return;
    const { environmentId, cwd } = folder;
    const readLog = () =>
      executeAtomQuery(
        registry,
        projectEnvironment.readFile({
          environmentId,
          input: { cwd, relativePath: ANSWERS_FILE, allowMissing: true },
        }),
        { ...QUIET, refresh: true },
      );
    const read = await readLog();
    const log = read._tag === "Success" && read.value.exists !== false ? read.value.contents : "";
    const write = (relativePath: string, contents: string) =>
      runAtomCommand(
        registry,
        projectEnvironment.writeFile,
        { environmentId, input: { cwd, relativePath, contents } },
        { label: projectEnvironment.writeFile.label, ...QUIET },
      );
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const line = `${stamp}: ${thread.title} (${thread.id}): ${sprintAnswerLine(answers)}`;
    const written = await write(ANSWERS_FILE, withSprintAnswer(log, line));
    if (written._tag !== "Success") return;
    await write(`${SPRINT_OWNER_EDITS_DIRECTORY}/${ANSWERS_FILE}`, `${new Date().toISOString()}\n`);
    // Read again, so the answered card shows the line just written.
    await readLog();
  };
}

/** Sends one response at a time and toasts a failure. */
function useOneResponse() {
  const [responding, setResponding] = useState<RuntimeRequestId | null>(null);
  const run = async (
    requestId: RuntimeRequestId,
    send: () => Promise<{ readonly _tag: string }>,
    failureTitle: string,
  ) => {
    if (responding !== null) return false;
    setResponding(requestId);
    const result = await send();
    setResponding(null);
    if (result._tag !== "Success") toastManager.add({ type: "error", title: failureTitle });
    return result._tag === "Success";
  };
  return { responding, run };
}

function RequestFrame(props: {
  readonly thread: EnvironmentThreadShell;
  readonly hostRef: ScopedThreadRef | null;
  readonly kind: "question" | "approval";
  readonly children: ReactNode;
}) {
  return (
    <div className="flex max-w-full flex-col gap-1" data-fork-thread-request-card={props.kind}>
      {/* Set in from the card's edge, so the arm drops onto the card rather than its corner. */}
      <div className="ps-3">
        <ForkThreadHookRow
          kind="request"
          arm="down"
          threadRef={scopeThreadRef(props.thread.environmentId, props.thread.id)}
          fallbackTitle={null}
          hostRef={props.hostRef}
        />
      </div>
      {props.children}
    </div>
  );
}

/** The thread's open question or approval, to answer here. */
export function ForkThreadRequestCard(props: {
  readonly thread: EnvironmentThreadShell;
  readonly hostRef: ScopedThreadRef | null;
  readonly kind: "question" | "approval";
}) {
  const ref = scopeThreadRef(props.thread.environmentId, props.thread.id);
  return (
    <RequestFrame {...props}>
      {props.kind === "question" ? (
        <div className={CARD}>
          <ThreadQuestion thread={props.thread} threadRef={ref} hostRef={props.hostRef} />
        </div>
      ) : (
        <div className="max-w-xl">
          <ThreadApproval thread={props.thread} threadRef={ref} hostRef={props.hostRef} />
        </div>
      )}
    </RequestFrame>
  );
}

const NO_LOG = Atom.make(AsyncResult.initial<ProjectReadFileResult, never>(false)).pipe(
  Atom.withLabel("fork-thread-answers:none"),
);

/** A settled question or approval. When the owner answered it from a sprint's card, the card stays
    with the question and the answer; otherwise the thread's row alone remains. */
export function ForkAnsweredRequest(props: {
  readonly thread: EnvironmentThreadShell;
  readonly hostRef: ScopedThreadRef | null;
  readonly kind: "question" | "approval";
}) {
  const folder = sprintFolder(useQuietThreadShell(props.hostRef));
  const result = useAtomValue(
    folder === null
      ? NO_LOG
      : projectEnvironment.readFile({
          environmentId: folder.environmentId,
          input: { cwd: folder.cwd, relativePath: ANSWERS_FILE, allowMissing: true },
        }),
  );
  const file = AsyncResult.getOrElse(result, () => null);
  const answers =
    file === null || file.exists === false
      ? null
      : sprintAnswersFor(file.contents, props.thread.id);
  if (answers === null) {
    return (
      <ForkThreadHookRow
        kind="report"
        threadRef={scopeThreadRef(props.thread.environmentId, props.thread.id)}
        fallbackTitle={null}
        hostRef={props.hostRef}
      />
    );
  }
  return (
    <RequestFrame thread={props.thread} hostRef={props.hostRef} kind={props.kind}>
      <div className={`${CARD} divide-y divide-border`} data-fork-thread-request-answered="">
        {answers.map((entry) => (
          <div key={entry.question} className="flex flex-col gap-1.5 px-4 py-3 text-sm">
            <p className="text-muted-foreground wrap-anywhere">{entry.question}</p>
            <p className="flex items-center gap-2 text-foreground">
              <CheckIcon className="size-3.5 shrink-0" />
              <span className="min-w-0 wrap-anywhere">{entry.answer}</span>
            </p>
          </div>
        ))}
      </div>
    </RequestFrame>
  );
}

function ThreadQuestion(props: {
  readonly thread: EnvironmentThreadShell;
  readonly threadRef: ScopedThreadRef;
  readonly hostRef: ScopedThreadRef | null;
}) {
  const { thread, threadRef } = props;
  const requests = useAtomValue(environmentThreadDetails.pendingRequestsAtom(threadRef));
  const canOperate = useEnvironmentScope(thread.environmentId, AuthOrchestrationOperateScope);
  const respond = useOrchestrationCommand(threadEnvironment.respondToUserInput, {
    reportFailure: false,
  });
  const dismiss = useOrchestrationCommand(threadEnvironment.dismissUserInput, {
    reportFailure: false,
  });
  const openThread = useOpenThreadBeside(props.hostRef, threadRef);
  const noteAnswer = useNoteAnswer(props.hostRef);
  const { responding, run } = useOneResponse();
  const input =
    requests === null || requests.userInputs.length === 0
      ? undefined
      : derivePendingUserInputs(requests.userInputs)[0];
  // The thread's own drafts, so a pick made here is there when the thread opens, and back here.
  const draftKey = userInputDraftKey(thread.environmentId, thread.id, input?.requestId);
  const stored = usePendingUserInputAnswers((state) => state[draftKey] ?? NO_ANSWERS);
  const index = usePendingUserInputQuestionIndex((state) => state[draftKey] ?? 0);
  if (input === undefined) return null;
  const answers: Record<string, PendingUserInputDraftAnswer> = seedUserInputDraftAnswers(
    input.questions,
    stored,
  );
  const canAnswer = canOperate && input.responseCapability !== "not_resumable";
  const question = input.questions[index];
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
          environmentId: thread.environmentId,
          input: { threadId: thread.id, requestId: input.requestId, answers: resolved },
        }),
      "Could not send the answer.",
    ).then((sent) => {
      if (!sent) return;
      void noteAnswer(
        thread,
        input.questions.map((entry) => {
          const given = resolved[entry.id];
          return {
            question: entry.question,
            answer: Array.isArray(given) ? given.join(", ") : String(given ?? ""),
          };
        }),
      );
    });
  };
  const advance = () => {
    const progress = derivePendingUserInputProgress(input.questions, answers, index);
    if (progress.isLastQuestion) submit();
    else if (progress.canAdvance)
      usePendingUserInputQuestionIndex.setState((existing) => ({
        ...existing,
        [draftKey]: index + 1,
      }));
  };
  return (
    <ComposerPendingUserInputPanel
      pendingUserInputs={[input]}
      cwd={thread.worktreePath ?? undefined}
      threadRef={threadRef}
      disabled={!canAnswer}
      respondingRequestIds={responding === null ? [] : [responding]}
      answers={answers}
      questionIndex={index}
      numberKeys={false}
      onToggleOption={(questionId, optionValue) => {
        const target = input.questions.find((entry) => entry.id === questionId);
        if (target === undefined) return;
        setDraft(
          questionId,
          togglePendingUserInputOptionSelection(target, answers[questionId], optionValue),
        );
      }}
      onAdvance={advance}
      onPrevious={() =>
        usePendingUserInputQuestionIndex.setState((existing) => ({
          ...existing,
          [draftKey]: Math.max(0, index - 1),
        }))
      }
      onDismiss={(requestId) => {
        if (!canOperate) return;
        void run(
          requestId,
          () =>
            dismiss({
              environmentId: thread.environmentId,
              input: { threadId: thread.id, requestId },
            }),
          "Could not dismiss the question.",
        );
      }}
      afterOptions={
        question === undefined || question.allowCustomAnswer === false ? null : (
          // A third choice under the options, sent with Submit like them.
          <div className="px-2 pt-1">
            <input
              type="text"
              aria-label="Your own answer"
              className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring disabled:opacity-64 dark:bg-input/32"
              placeholder="Or type your own answer"
              disabled={!canAnswer}
              value={answers[question.id]?.customAnswer ?? ""}
              onChange={(event) =>
                setDraft(
                  question.id,
                  setPendingUserInputCustomAnswer(
                    question,
                    answers[question.id],
                    event.target.value,
                  ),
                )
              }
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                advance();
              }}
              data-testid="fork-thread-request-typed-answer"
            />
          </div>
        )
      }
      afterActions={
        <button
          type="button"
          className="ms-auto h-8 shrink-0 rounded-md px-2.5 text-sm text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          onClick={openThread}
        >
          Open thread
        </button>
      }
    />
  );
}

const DECISION_WORDS: Partial<Record<ProviderApprovalDecision, string>> = {
  accept: "Approved",
  acceptForSession: "Approved for this session",
  acceptAlways: "Always approved",
  decline: "Declined",
  cancel: "Declined",
};

function ThreadApproval(props: {
  readonly thread: EnvironmentThreadShell;
  readonly threadRef: ScopedThreadRef;
  readonly hostRef: ScopedThreadRef | null;
}) {
  const { thread, threadRef } = props;
  const requests = useAtomValue(environmentThreadDetails.pendingRequestsAtom(threadRef));
  const canOperate = useEnvironmentScope(thread.environmentId, AuthOrchestrationOperateScope);
  const respond = useOrchestrationCommand(threadEnvironment.respondToApproval, {
    reportFailure: false,
  });
  const noteAnswer = useNoteAnswer(props.hostRef);
  const { responding, run } = useOneResponse();
  const approvals =
    requests === null || requests.approvals.length === 0
      ? []
      : derivePendingApprovals(requests.approvals);
  const approval = approvals[0];
  if (approval === undefined) return null;
  const onRespondToApproval = async (
    requestId: RuntimeRequestId,
    decision: ProviderApprovalDecision,
  ) => {
    const sent = await run(
      requestId,
      () =>
        respond({
          environmentId: thread.environmentId,
          input: { threadId: thread.id, requestId, decision },
        }),
      "Could not send the decision.",
    );
    if (sent) {
      void noteAnswer(thread, [
        {
          question: approval.detail ?? approval.requestKind,
          answer: DECISION_WORDS[decision] ?? decision,
        },
      ]);
    }
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
          aside: true,
        }),
      ]}
    />
  );
}
