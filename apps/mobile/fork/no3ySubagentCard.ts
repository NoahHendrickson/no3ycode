/**
 * The no3y transcript subagent card's words — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 * Ported from the Mac fork's card (apps/web/src/custom/forkSubagentTree.ts), not imported.
 */

/** The line under the title: model and effort, else the status word. */
export function no3ySubagentSpec(input: {
  readonly modelLabel: string | null;
  readonly effort: string | null;
  readonly statusLabel: string;
}): string {
  const model = input.modelLabel === "Not reported" ? null : input.modelLabel;
  return [model, input.effort].filter(Boolean).join(" · ") || input.statusLabel;
}
