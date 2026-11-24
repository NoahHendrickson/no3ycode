import { type RuntimeRequestId, type ScopedThreadRef } from "@t3tools/contracts";
import { useGT } from "gt-react";
import { memo } from "react";
import { CheckIcon, XIcon } from "lucide-react";

import { Button } from "~/components/ui/button";

import { useComposerPendingUserInputCard } from "~/custom/useComposerPendingUserInputCard";
import { ComposerBanner } from "./ComposerBanner";
import ChatMarkdown from "../ChatMarkdown";
import { cn } from "~/lib/utils";
import type { PendingUserInputDraftAnswer } from "@t3tools/client-runtime/state/pending-user-input";
import { markdownProseDirection, textDirection } from "~/textDirection";
import { type PendingUserInput } from "~/session-logic";

interface PendingUserInputPanelProps {
  pendingUserInputs: PendingUserInput[];
  cwd: string | undefined;
  threadRef: ScopedThreadRef;
  disabled?: boolean;
  respondingRequestIds: RuntimeRequestId[];
  answers: Record<string, PendingUserInputDraftAnswer>;
  questionIndex: number;
  onToggleOption: (questionId: string, optionValue: string) => void;
  onAdvance: () => void;
  /** Back to the previous question; the card owns Previous and Submit. */
  onPrevious?: () => void;
  onDismiss: (requestId: RuntimeRequestId) => void;
}

export const ComposerPendingUserInputPanel = memo(function ComposerPendingUserInputPanel({
  pendingUserInputs,
  cwd,
  threadRef,
  disabled = false,
  respondingRequestIds,
  answers,
  questionIndex,
  onToggleOption,
  onAdvance,
  onPrevious,
  onDismiss,
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
      isResponding={respondingRequestIds.includes(activePrompt.requestId)}
      answers={answers}
      questionIndex={questionIndex}
      onToggleOption={onToggleOption}
      onAdvance={onAdvance}
      onPrevious={onPrevious}
      onDismiss={onDismiss}
    />
  );
});

function OptionControl({ multiSelect, selected }: { multiSelect: boolean; selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-fork-question-control
      className={cn(
        "flex size-4 shrink-0 items-center justify-center border border-foreground/50",
        multiSelect ? "rounded-[4px]" : "rounded-full",
        selected && "border-transparent",
      )}
    >
      {selected ? (
        multiSelect ? (
          <CheckIcon className="size-3" strokeWidth={3} />
        ) : (
          <span className="size-1.5 rounded-full bg-current" />
        )
      ) : null}
    </span>
  );
}

const ComposerPendingUserInputCard = memo(function ComposerPendingUserInputCard({
  prompt,
  cwd,
  threadRef,
  disabled,
  isResponding,
  answers,
  questionIndex,
  onToggleOption,
  onAdvance,
  onPrevious,
  onDismiss,
}: {
  prompt: PendingUserInput;
  cwd: string | undefined;
  threadRef: ScopedThreadRef;
  disabled: boolean;
  isResponding: boolean;
  answers: Record<string, PendingUserInputDraftAnswer>;
  questionIndex: number;
  onToggleOption: (questionId: string, optionValue: string) => void;
  onAdvance: () => void;
  onPrevious?: (() => void) | undefined;
  onDismiss: (requestId: RuntimeRequestId) => void;
}) {
  const gt = useGT();
  // Upstream #9786: a client without the operate scope sees the questions but
  // cannot answer. The hook owns the click and number-key guards
  // from the same two inputs; the option buttons mirror them visually.
  const interactionDisabled = disabled || isResponding;
  const { progress, activeQuestion, optimisticSingleSelect, handleOptionSelection } =
    useComposerPendingUserInputCard({
      prompt,
      disabled,
      isResponding,
      answers,
      questionIndex,
      onToggleOption,
    });

  if (!activeQuestion) {
    return null;
  }

  const customAnswerActive = progress.customAnswer.trim().length > 0;
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
    <div data-fork-pending-user-input="true" dir={promptDirection} className="flex flex-col">
      {/* The question is the card's header, ruled off from its options; a long one scrolls in
          place (upstream #12166) and unbroken words wrap. */}
      <div data-fork-pending-user-input-question className="flex items-start gap-4 px-4 py-3">
        <div className="flex max-h-40 min-w-0 flex-1 flex-col overflow-y-auto text-sm wrap-anywhere">
          <ChatMarkdown
            text={activeQuestion.question}
            cwd={cwd}
            threadRef={threadRef}
            lineBreaks
            className={cn("text-foreground", questionTextAlign)}
          />
        </div>
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
      </div>

      <ComposerBanner.Scroll>
        <div className="flex flex-col px-2 pt-2 pb-3 wrap-anywhere">
          {/* The selection hint heads the options it describes, aligned with their labels. */}
          <p data-fork-question-hint className="px-2 pb-1 text-xs text-muted-foreground">
            {multiSelect ? "Select one or more" : "Select one"}
          </p>
          <div className="flex flex-col gap-1" role={multiSelect ? "group" : "radiogroup"}>
            {activeQuestion.options.map((option, index) => {
              const optionValue = option.value ?? option.label;
              const isOptimisticallySelected =
                optimisticSingleSelect?.questionId === activeQuestion.id &&
                optimisticSingleSelect.optionValue === optionValue;
              const isSelected =
                isOptimisticallySelected ||
                (!customAnswerActive && progress.selectedOptionValues.includes(optionValue));
              const digitShortcut = index < 9 ? String(index + 1) : undefined;

              // The preview sits outside the button: it can hold links, and a click on a single-select option advances.
              return (
                <div key={`${activeQuestion.id}:${optionValue}`} className="flex flex-col gap-1">
                  <button
                    type="button"
                    role={multiSelect ? "checkbox" : "radio"}
                    aria-checked={isSelected}
                    data-fork-question-option
                    aria-keyshortcuts={digitShortcut}
                    disabled={interactionDisabled}
                    onClick={() => {
                      handleOptionSelection(activeQuestion.id, optionValue);
                    }}
                    className={cn(
                      questionTextAlign,
                      "group flex w-full flex-col gap-1 rounded-xl border p-2 outline-none transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring/40",
                      isSelected
                        ? "border-foreground/24 bg-foreground/8 text-foreground"
                        : "border-transparent hover:bg-foreground/4",
                      interactionDisabled && "cursor-not-allowed opacity-50",
                      !interactionDisabled && "cursor-pointer",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <OptionControl multiSelect={multiSelect} selected={isSelected} />
                      <span className="text-sm text-foreground" dir={textDirection(option.label)}>
                        {option.label}
                      </span>
                    </div>
                    {option.description && option.description !== option.label ? (
                      <div className="flex w-full items-center pl-6">
                        <span
                          className={cn(
                            "flex-1 text-sm font-normal",
                            isSelected ? "text-foreground/80" : "text-muted-foreground",
                          )}
                          dir={textDirection(option.description)}
                        >
                          {option.description}
                        </span>
                      </div>
                    ) : null}
                  </button>
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
          </div>
        </div>
      </ComposerBanner.Scroll>

      {/* Picking an option never submits: Submit (or Next) is the card's own button, bottom
          left, sized like the other notice cards' actions. */}
      <div
        data-fork-pending-user-input-footer
        className="flex items-center justify-start gap-2 px-4 pb-3"
      >
        <Button
          size="sm"
          variant="default"
          data-fork-pending-user-input-submit
          data-fork-composer-notice-action="primary"
          disabled={
            interactionDisabled ||
            (progress.isLastQuestion ? !progress.isComplete : !progress.canAdvance)
          }
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
        {questionIndex > 0 && onPrevious ? (
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
      </div>
    </div>
  );
});
