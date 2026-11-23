/**
 * New agent's Home tab picks its project in place, on its glass rows, and starts with none — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`. The draft screen's upstream entry flow pushes
 * the project picker for a draft with no chosen project and, once it closes unanswered, leaves
 * the draft; under Home there is nothing to leave, so it replaced Home and pushed the picker again.
 */

/** Shown in the composer, and blocking send, until a project (or No project) is picked. */
export const NO3Y_PICK_PROJECT_REASON = "Pick a project above to start";

/** A Home tab never opens the picker ("pick") or leaves for it ("dismiss"): it stays on its rows. */
export function no3yInPlaceSkipsPicker(
  selection: "preserve" | "select" | "pick" | "dismiss",
): boolean {
  return selection === "pick" || selection === "dismiss";
}

/**
 * New agent sends nowhere until a project is chosen; the flow's fallback project does not count.
 * Chat names its project on the draft, so it never waits.
 */
export function no3yProjectPickBlockReason(input: {
  readonly inPlace: boolean;
  readonly draftNamesProject: boolean;
  readonly selectedProjectKey: string | null;
}): string | null {
  return input.inPlace && !input.draftNamesProject && input.selectedProjectKey === null
    ? NO3Y_PICK_PROJECT_REASON
    : null;
}
