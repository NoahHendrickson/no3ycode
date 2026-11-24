/**
 * Shared pending-user-input card logic for the fork Questions chrome.
 * See `.fork/customizations.yaml#fork-pending-user-input`.
 *
 * Owns the selection guards and number-key selection so the override can stay presentational.
 * Picking an option never submits or advances: a mis-click stays correctable, and the card's
 * own Submit moves on. The selection rule itself is togglePendingUserInputOptionSelection's.
 * Port upstream effect fixes here first.
 */

import { useEffect, useLayoutEffect, useRef } from "react";

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

  // ComposerPendingUserInputCard is `memo(fn)`, and react-dom applies
  // useEffectEvent impls only for FunctionComponent fibers — memo and
  // forwardRef hosts are skipped outright (`case 11: case 15: break;` in
  // commitBeforeMutationEffects, react-dom 19.2.6). The card is keyed by
  // requestId, so it stays mounted while questionIndex advances, and an effect
  // event here would answer every later question with question 1's closure.
  // A layout-phase mirror instead, the same shape and reasoning as
  // useForkDictationHotkeyTarget. Audit on a React bump: grep useEffectEvent,
  // check whether the host component is memoized or a forwardRef.
  const latestRef = useRef({ onToggleOption, responseDisabled });
  useLayoutEffect(() => {
    latestRef.current = { onToggleOption, responseDisabled };
  });

  // Everything this reads comes from the mirror, so the compiler keeps it stable
  // and the number-key listener below is not rebuilt per render.
  const handleOptionSelection = (questionId: string, optionValue: string) => {
    if (latestRef.current.responseDisabled) return;
    latestRef.current.onToggleOption(questionId, optionValue);
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
    responseDisabled,
    handleOptionSelection,
  } as const;
}
