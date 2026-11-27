import { type RuntimeRequestId, type ScopedThreadRef } from "@t3tools/contracts";
import { useGT } from "gt-react";
import { memo, type ReactNode } from "react";
import { XIcon } from "lucide-react";

import { Button } from "~/components/ui/button";

import { ForkQuestionCard } from "~/custom/ForkQuestionCard";
import { ForkQuestionOption } from "~/custom/ForkQuestionOption";
import { useComposerPendingUserInputCard } from "~/custom/useComposerPendingUserInputCard";
import ChatMarkdown from "../ChatMarkdown";
import { cn } from "~/lib/utils";
import {
  isPendingUserInputOptionSelected,
  type PendingUserInputDraftAnswer,
} from "@t3tools/client-runtime/state/pending-user-input";
import { markdownProseDirection } from "~/textDirection";
import { type PendingUserInput } from "~/session-logic";

interface PendingUserInputPanelProps {
  pendingUserInputs: PendingUserInput[];
  cwd: string | undefined;
  threadRef: ScopedThreadRef;
  disabled?: boolean;
  /** Why the composer's own send is blocked (e.g. an attachment the server can't take). */
  submitDisabledReason?: string | null;
  respondingRequestIds: RuntimeRequestId[];
  answers: Record<string, PendingUserInputDraftAnswer>;
  questionIndex: number;
  onToggleOption: (questionId: string, optionValue: string) => void;
  onAdvance: () => void;
  /** Back to the previous question; the card owns Previous and Submit. */
  onPrevious: () => void;
  onDismiss: (requestId: RuntimeRequestId) => void;
  /** Drawn last inside the card: a Petal's copy of a work thread's question names that thread. */
  footer?: ReactNode;
  /** Under the options, above Submit: an inline card's typed answer (fork-thread-launch-cards). */
  afterOptions?: ReactNode;
  /** After Submit and Previous, at the row's end: an inline card's Open thread. */
  afterActions?: ReactNode;
  /** Off for a copy shown beside another question, so a digit picks on the thread's own card. */
  numberKeys?: boolean;
}

export const ComposerPendingUserInputPanel = memo(function ComposerPendingUserInputPanel({
  pendingUserInputs,
  cwd,
  threadRef,
  disabled = false,
  submitDisabledReason = null,
  respondingRequestIds,
  answers,
  questionIndex,
  onToggleOption,
  onAdvance,
  onPrevious,
  onDismiss,
  footer,
  afterOptions,
  afterActions,
  numberKeys = true,
}: PendingUserInputPanelProps) {
  if (pendingUserInputs.length === 0) return null;
  const activePrompt = pendingUserInputs[0];
  if (!activePrompt) return null;

  return (
    <ComposerPendingUserInputCard
      key={activePrompt.requestId}
      prompt={activePrompt}
      cwd={cwd}
      threadRef={threadRef}
      disabled={disabled}
      submitDisabledReason={submitDisabledReason}
      isResponding={respondingRequestIds.includes(activePrompt.requestId)}
      answers={answers}
      questionIndex={questionIndex}
      onToggleOption={onToggleOption}
      onAdvance={onAdvance}
      onPrevious={onPrevious}
      onDismiss={onDismiss}
      footer={footer}
      afterOptions={afterOptions}
      afterActions={afterActions}
      numberKeys={numberKeys}
    />
  );
});

const ComposerPendingUserInputCard = memo(function ComposerPendingUserInputCard({
  prompt,
  cwd,
  threadRef,
  disabled,
  submitDisabledReason,
  isResponding,
  answers,
  questionIndex,
  onToggleOption,
  onAdvance,
  onPrevious,
  onDismiss,
  footer,
  afterOptions,
  afterActions,
  numberKeys,
}: {
  prompt: PendingUserInput;
  cwd: string | undefined;
  threadRef: ScopedThreadRef;
  disabled: boolean;
  submitDisabledReason: string | null;
  isResponding: boolean;
  answers: Record<string, PendingUserInputDraftAnswer>;
  questionIndex: number;
  onToggleOption: (questionId: string, optionValue: string) => void;
  onAdvance: () => void;
  onPrevious: () => void;
  onDismiss: (requestId: RuntimeRequestId) => void;
  footer: ReactNode;
  afterOptions: ReactNode;
  afterActions: ReactNode;
  numberKeys: boolean;
}) {
  const gt = useGT();
  // Upstream #9786: a client without the operate scope sees the questions but
  // cannot answer. The hook owns the click and number-key guards
  // from the same two inputs; the option buttons mirror them visually.
  const interactionDisabled = disabled || isResponding;
  const { progress, activeQuestion, handleOptionSelection } = useComposerPendingUserInputCard({
    prompt,
    disabled,
    isResponding,
    answers,
    questionIndex,
    onToggleOption,
    numberKeys,
  });

  if (!activeQuestion) {
    return null;
  }

  const multiSelect = activeQuestion.multiSelect === true;
  // Upstream: right-to-left prompts lay out and align right to left.
  const promptDirection = markdownProseDirection(
    prompt.questions
      .flatMap((question) => [
        question.header,
        question.question,
        ...question.options.flatMap((option) => [option.label, option.description ?? ""]),
      ])
      .join(" "),
  );
  const questionTextAlign = promptDirection === "rtl" ? "text-right" : "text-left";

  return (
    <ForkQuestionCard
      dir={promptDirection}
      // A long question scrolls in place.
      question={
        <ChatMarkdown
          text={activeQuestion.question}
          cwd={cwd}
          threadRef={threadRef}
          lineBreaks
          className={cn("text-foreground", questionTextAlign)}
        />
      }
      aside={
        <>
          {prompt.questions.length > 1 ? (
            <span className="shrink-0 text-sm font-medium text-muted-foreground tabular-nums">
              {questionIndex + 1}/{prompt.questions.length}
            </span>
          ) : null}
          {prompt.dismissible ? (
            // Async questions may be closed without a reply. The fork header is a
            // plain row rather than upstream's disclosure trigger, so this is a
            // real button and needs none of upstream's click/keydown containment.
            <Button
              size="icon-sm"
              variant="ghost"
              className="-my-1 shrink-0"
              aria-label={gt("Dismiss question without answering")}
              title={gt("Dismiss question without answering")}
              disabled={isResponding}
              data-pending-user-input-dismiss
              onClick={() => {
                onDismiss(prompt.requestId);
              }}
            >
              <XIcon />
            </Button>
          ) : null}
        </>
      }
      hint={multiSelect ? "Select one or more" : "Select one"}
      multiSelect={multiSelect}
      options={
        <>
          {activeQuestion.options.map((option, index) => {
            const optionValue = option.value ?? option.label;
            const isSelected = isPendingUserInputOptionSelected(
              activeQuestion,
              answers[activeQuestion.id],
              optionValue,
            );
            const digitShortcut = numberKeys && index < 9 ? String(index + 1) : undefined;

            // The preview sits outside the button: it can hold links.
            return (
              <div key={`${activeQuestion.id}:${optionValue}`} className="flex flex-col gap-1">
                <ForkQuestionOption
                  label={option.label}
                  description={option.description}
                  multiSelect={multiSelect}
                  selected={isSelected}
                  disabled={interactionDisabled}
                  keyShortcut={digitShortcut}
                  textAlignClassName={questionTextAlign}
                  onSelect={() => {
                    handleOptionSelection(activeQuestion.id, optionValue);
                  }}
                />
                {option.preview ? (
                  <ChatMarkdown
                    text={option.preview}
                    cwd={cwd}
                    threadRef={threadRef}
                    lineBreaks
                    className="ps-8 pe-2 text-xs text-muted-foreground"
                  />
                ) : null}
              </div>
            );
          })}
          {afterOptions}
        </>
      }
      // Picking an option never submits: Submit (or Next) is the card's own button, bottom
      // left, sized like the other notice cards' actions.
      actions={
        <>
          <Button
            size="sm"
            variant="default"
            data-fork-pending-user-input-submit
            data-fork-composer-notice-action="primary"
            disabled={
              interactionDisabled ||
              submitDisabledReason !== null ||
              (progress.isLastQuestion ? !progress.isComplete : !progress.canAdvance)
            }
            title={submitDisabledReason ?? undefined}
            onClick={onAdvance}
          >
            {isResponding
              ? gt("Submitting...")
              : !progress.isLastQuestion
                ? gt("Next", { $context: "button that goes to the next question" })
                : prompt.questions.length > 1
                  ? gt("Submit answers")
                  : gt("Submit", { $context: "verb, submits answers" })}
          </Button>
          {questionIndex > 0 ? (
            <Button
              size="sm"
              variant="outline"
              data-fork-composer-notice-action="secondary"
              disabled={isResponding}
              onClick={onPrevious}
            >
              {gt("Previous", { $context: "button that goes to the previous question" })}
            </Button>
          ) : null}
          {afterActions}
        </>
      }
      footer={footer}
    />
  );
});
