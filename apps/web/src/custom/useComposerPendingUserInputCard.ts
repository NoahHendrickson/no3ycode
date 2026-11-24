/**
 * Shared pending-user-input card logic for the fork Questions chrome.
 * See `.fork/customizations.yaml#fork-pending-user-input`.
 *
 * Owns optimistic single-select and number-key selection so the override can stay
 * presentational. Picking an option never submits or advances: a mis-click stays
 * correctable, and the card's own Submit moves on. Port upstream effect fixes here first.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { PendingUserInputDraftAnswer } from "@t3tools/client-runtime/state/pending-user-input";
import { derivePendingUserInputProgress } from "~/pendingUserInput";
import { isInSideChatPane } from "~/lib/sideChatPane";
import { type PendingUserInput } from "~/session-logic";
import { useOwnsGlobalInput } from "./splitThreads/splitPaneContext";

export function useComposerPendingUserInputCard({
  prompt,
  disabled = false,
  isResponding,
  answers,
  questionIndex,
  onToggleOption,
}: {
  prompt: PendingUserInput;
  /** Upstream #9786: the client lacks the operate scope, so the card is read-only. */
  disabled?: boolean;
  isResponding: boolean;
  answers: Record<string, PendingUserInputDraftAnswer>;
  questionIndex: number;
  onToggleOption: (questionId: string, optionValue: string) => void;
}) {
  const progress = derivePendingUserInputProgress(prompt.questions, answers, questionIndex);
  const activeQuestion = progress.activeQuestion;
  // Message-mode requests remain answerable after their provider turn ends.
  const canRespond = prompt.responseCapability !== "not_resumable";
  const responseDisabled = disabled || isResponding || !canRespond;
  const [optimisticSingleSelect, setOptimisticSingleSelect] = useState<{
    questionId: string;
    optionValue: string;
  } | null>(null);

  // ComposerPendingUserInputCard is `memo(fn)`, and react-dom applies
  // useEffectEvent impls only for FunctionComponent fibers — memo and
  // forwardRef hosts are skipped outright (`case 11: case 15: break;` in
  // commitBeforeMutationEffects, react-dom 19.2.6). The card is keyed by
  // requestId, so it stays mounted while questionIndex advances, and an effect
  // event here would answer every later question with question 1's closure.
  // A layout-phase mirror instead, the same shape and reasoning as
  // useForkDictationHotkeyTarget. Audit on a React bump: grep useEffectEvent,
  // check whether the host component is memoized or a forwardRef.
  // What reads as picked right now: the optimistic pick, else the saved one (no typed answer).
  const pickedValues = optimisticSingleSelect
    ? [optimisticSingleSelect.optionValue]
    : progress.customAnswer.trim().length > 0
      ? []
      : progress.selectedOptionValues;
  const latestRef = useRef({ activeQuestion, onToggleOption, responseDisabled, pickedValues });
  useLayoutEffect(() => {
    latestRef.current = { activeQuestion, onToggleOption, responseDisabled, pickedValues };
  });

  useEffect(() => {
    if (!activeQuestion || activeQuestion.multiSelect || !optimisticSingleSelect) {
      return;
    }
    if (optimisticSingleSelect.questionId !== activeQuestion.id) {
      setOptimisticSingleSelect(null);
      return;
    }
    if (
      progress.customAnswer.trim().length === 0 &&
      progress.selectedOptionValues.includes(optimisticSingleSelect.optionValue)
    ) {
      setOptimisticSingleSelect(null);
    }
  }, [
    activeQuestion,
    optimisticSingleSelect,
    progress.customAnswer,
    progress.selectedOptionValues,
  ]);

  // Everything this reads comes from the mirror or a setState, so the compiler
  // keeps it stable and the number-key listener below is not rebuilt per render.
  const handleOptionSelection = (questionId: string, optionValue: string) => {
    const { activeQuestion: question, onToggleOption: toggle } = latestRef.current;
    if (latestRef.current.responseDisabled) return;
    if (question?.multiSelect) {
      toggle(questionId, optionValue);
      return;
    }
    // Clicking the picked option again clears it (the toggle does the same to the draft).
    const unpick = latestRef.current.pickedValues.includes(optionValue);
    setOptimisticSingleSelect(unpick ? null : { questionId, optionValue });
    toggle(questionId, optionValue);
  };

  // Number keys 1-9 pick options when focus is outside editable fields: multi-select toggles
  // in place, single-select selects. Only the pane that owns window input takes them
  // (focused in a split, not behind Settings or Usage: fork-split-threads).
  const ownsInput = useOwnsGlobalInput();
  useEffect(() => {
    if (!activeQuestion || responseDisabled || !ownsInput) return;
    const handler = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (isInSideChatPane(target)) return;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        return;
      }
      // A digit typed into a menu, dialog or popup stays there, as upstream's panel does.
      if (
        target instanceof HTMLElement &&
        target.closest(
          'select, [contenteditable]:not([contenteditable="false"]), [role="dialog"], [aria-modal="true"], [role="menu"], [role="combobox"], [data-slot$="popup"]',
        )
      ) {
        return;
      }
      const digit = Number.parseInt(event.key, 10);
      if (Number.isNaN(digit) || digit < 1 || digit > 9) return;
      const optionIndex = digit - 1;
      if (optionIndex >= activeQuestion.options.length) return;
      const option = activeQuestion.options[optionIndex];
      if (!option) return;
      event.preventDefault();
      handleOptionSelection(activeQuestion.id, option.value ?? option.label);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [activeQuestion, responseDisabled, handleOptionSelection, ownsInput]);

  return {
    progress,
    activeQuestion,
    optimisticSingleSelect,
    responseDisabled,
    handleOptionSelection,
  } as const;
}
