/**
 * A thread's question or approval, answered from the conversation that started it — see
 * `.fork/customizations.yaml#fork-thread-launch-cards`. Drawn where the conversation's host answers
 * inline (forkThreadHost: a sprint). The thread's row heads a card with its arm turned down; the
 * answer goes to the thread itself, and the host hears it, so it can keep the card answered.
 */
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { setPendingUserInputCustomAnswer } from "@t3tools/client-runtime/state/pending-user-input";
import type {
  ProviderApprovalDecision,
  RuntimeRequestId,
  ScopedThreadRef,
} from "@t3tools/contracts";
import type { ReactNode } from "react";

import { ComposerBannerStack } from "~/components/chat/ComposerBannerStack";
import { ComposerPendingUserInputPanel } from "~/components/chat/ComposerPendingUserInputPanel";

import {
  useChildApproval,
  useChildQuestion,
  useChildRequestPending,
} from "../childRequestControls";
import { CheckIcon } from "../icons/lucide-hugeicons";
import { ForkThreadHookRow, useOpenThreadBeside } from "./ForkThreadLaunchCards";
import { type ForkRequestAnswer, useForkThreadHost } from "./forkThreadHost";

/** Shared inline card surface under a thread row (question, answered request, ready-to-merge). */
export const FORK_THREAD_CARD_SURFACE = "overflow-hidden rounded-xl border border-border";

/** Ruled into sections as the Questions card above the composer is; only the question is filled. */
const CARD = `max-w-xl ${FORK_THREAD_CARD_SURFACE} [&_[data-fork-pending-user-input-question]]:bg-card [&_[data-fork-pending-user-input-question]]:border-b [&_[data-fork-pending-user-input-question]]:border-border`;

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

/** The thread's open question or approval `requestId`, to answer here; `settled` once the
    thread no longer waits on it, another of its requests still open. */
export function ForkThreadRequestCard(props: {
  readonly thread: EnvironmentThreadShell;
  readonly hostRef: ScopedThreadRef | null;
  readonly kind: "question" | "approval";
  readonly requestId: RuntimeRequestId;
  readonly settled: ReactNode;
}) {
  const pending = useChildRequestPending(props.thread, props.requestId);
  if (pending === false) return props.settled;
  return (
    <RequestFrame thread={props.thread} hostRef={props.hostRef} kind={props.kind}>
      {props.kind === "question" ? (
        <div className={CARD}>
          <ThreadQuestion
            thread={props.thread}
            hostRef={props.hostRef}
            requestId={props.requestId}
          />
        </div>
      ) : (
        <div className="max-w-xl">
          <ThreadApproval thread={props.thread} requestId={props.requestId} />
        </div>
      )}
    </RequestFrame>
  );
}

/** A settled question or approval whose answers the host kept: the card stays, with the
    question and the answer. */
export function ForkAnsweredRequestCard(props: {
  readonly thread: EnvironmentThreadShell;
  readonly hostRef: ScopedThreadRef | null;
  readonly kind: "question" | "approval";
  readonly answers: ReadonlyArray<ForkRequestAnswer>;
}) {
  return (
    <RequestFrame thread={props.thread} hostRef={props.hostRef} kind={props.kind}>
      <div className={`${CARD} divide-y divide-border`} data-fork-thread-request-answered="">
        {props.answers.map((entry) => (
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
  readonly hostRef: ScopedThreadRef | null;
  readonly requestId: RuntimeRequestId;
}) {
  const { thread } = props;
  const host = useForkThreadHost();
  const openThread = useOpenThreadBeside(
    props.hostRef,
    scopeThreadRef(thread.environmentId, thread.id),
  );
  const controls = useChildQuestion(
    thread,
    (input, resolved) =>
      host?.onAnswered(
        thread,
        input.requestId,
        input.questions.map((entry) => {
          const given = resolved[entry.id];
          return {
            question: entry.question,
            answer: Array.isArray(given) ? given.join(", ") : String(given ?? ""),
          };
        }),
      ),
    props.requestId,
  );
  if (controls === null) return null;
  const { question, answers, canAnswer, setDraft, advance } = controls;
  return (
    <ComposerPendingUserInputPanel
      {...controls.panel}
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
                // Enter while an IME composes picks a candidate, not the answer.
                if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
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
  readonly requestId: RuntimeRequestId;
}) {
  const { thread } = props;
  const host = useForkThreadHost();
  const controls = useChildApproval(
    thread,
    (approval, decision) =>
      host?.onAnswered(thread, approval.requestId, [
        {
          question: approval.detail ?? approval.requestKind,
          answer: DECISION_WORDS[decision] ?? decision,
        },
      ]),
    props.requestId,
  );
  return controls === null ? null : <ComposerBannerStack items={[controls.notice()]} />;
}
