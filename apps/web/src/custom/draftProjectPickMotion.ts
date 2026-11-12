/**
 * A picked quick-pick pill opens into the draft's project chip, and the chips
 * the pick brings in fade in — see
 * `.fork/customizations.yaml#fork-draft-project-quick-picks`.
 */
import { useState } from "react";

import type { DraftId } from "~/composerDraftStore";
import { useDeadlinePassed } from "~/hooks/useDeadline";

const SETTLE = { duration: 320, easing: "cubic-bezier(0.23, 1, 0.32, 1)" } as const;

/** How long after a pick a toolbar that mounts still fades its chips in. */
const JOIN_WINDOW_MS = 1_500;

// Module state, not component state: the chip remounts mid-slide when the
// assignment settles and ChatView swaps the fallback strip for BranchToolbar.
const pickByDraftId = new Map<DraftId, { readonly from: DOMRect; readonly at: number }>();

export function rememberDraftProjectPick(draftId: DraftId, pill: Element): void {
  const at = Date.now();
  for (const [id, pick] of pickByDraftId) {
    if (at - pick.at >= JOIN_WINDOW_MS) pickByDraftId.delete(id);
  }
  pickByDraftId.set(draftId, { from: pill.getBoundingClientRect(), at });
}

/** Slides the chip in from the picked pill; a remounted chip resumes where the last one was. */
export function playDraftProjectPick(draftId: DraftId, chip: HTMLElement): void {
  const pick = pickByDraftId.get(draftId);
  if (!pick) return;
  const elapsed = Date.now() - pick.at;
  if (elapsed >= SETTLE.duration || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  const to = chip.getBoundingClientRect();
  const animation = chip.animate(
    [
      {
        transform: `translateX(${pick.from.left - to.left}px)`,
        clipPath: `inset(0 ${Math.max(0, to.width - pick.from.width)}px 0 0 round 8px)`,
      },
      { transform: "translateX(0)", clipPath: "inset(0 0 0 0 round 8px)" },
    ],
    SETTLE,
  );
  animation.currentTime = elapsed;
}

/** True while a context strip mounted just after a pick should fade its chips in
    (theme.custom.css keys the fade on the strip's data-fork-chips-joining). */
export function useDraftProjectChipsJoining(draftId: DraftId | null): boolean {
  const [deadlineMs] = useState(() => {
    const pick = draftId === null ? undefined : pickByDraftId.get(draftId);
    return pick === undefined ? null : pick.at + JOIN_WINDOW_MS;
  });
  const passed = useDeadlinePassed(deadlineMs);
  return deadlineMs !== null && !passed;
}
