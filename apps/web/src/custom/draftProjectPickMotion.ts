/**
 * A picked quick-pick pill opens into the draft's project chip — see
 * `.fork/customizations.yaml#fork-draft-project-quick-picks`.
 */
import type { DraftId } from "~/composerDraftStore";

const SETTLE = { duration: 320, easing: "cubic-bezier(0.23, 1, 0.32, 1)" } as const;

// Module state, not component state: the chip remounts mid-slide when the
// assignment settles and ChatView swaps the fallback strip for BranchToolbar.
const pickByDraftId = new Map<DraftId, { readonly from: DOMRect; readonly at: number }>();

export function rememberDraftProjectPick(draftId: DraftId, pill: Element): void {
  pickByDraftId.set(draftId, { from: pill.getBoundingClientRect(), at: Date.now() });
}

/** Slides the chip in from the picked pill; a remounted chip resumes where the last one was. */
export function playDraftProjectPick(draftId: DraftId, chip: HTMLElement): void {
  const pick = pickByDraftId.get(draftId);
  if (!pick) return;
  const elapsed = Date.now() - pick.at;
  if (elapsed >= SETTLE.duration) {
    pickByDraftId.delete(draftId);
    return;
  }
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
