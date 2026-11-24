/**
 * Paging through an agent's questions on the no3y card, as the Mac's Questions card does — see
 * `.fork/customizations.yaml#fork-pending-user-input`: one question at a time, a single-select
 * pick moves on, a multi-select toggles in place, and the last question submits.
 */
export function no3yQuestionAfterSelect(input: {
  readonly index: number;
  readonly count: number;
  readonly multiSelect: boolean;
}): number {
  if (input.multiSelect) return input.index;
  return Math.min(input.index + 1, Math.max(0, input.count - 1));
}

export function no3yQuestionFooter(
  index: number,
  count: number,
): { readonly previous: boolean; readonly primary: "next" | "submit" } {
  return { previous: index > 0, primary: index >= count - 1 ? "submit" : "next" };
}
