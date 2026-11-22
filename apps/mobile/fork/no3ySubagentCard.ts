/**
 * The no3y transcript subagent card's words — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 * Ported from the Mac fork's card (apps/web/src/custom/forkSubagentTree.ts), not imported.
 */
import { subagentCardDetail } from "../src/features/threads/subagent-card-presentation";

export interface No3ySubagentActivity {
  readonly label: "Now" | "Result";
  readonly text: string;
  /** A bare path (no spaces) truncates in the middle, so it keeps its filename. */
  readonly shape: "path" | "prose";
}

/** Live progress while it works, its result once settled; never one standing in for the other. */
export function no3ySubagentActivity(input: {
  readonly active: boolean;
  readonly progress: string | undefined;
  readonly result: string | null;
}): No3ySubagentActivity | null {
  const text = subagentCardDetail((input.active ? input.progress : input.result)?.trim() ?? null);
  if (!text) return null;
  return {
    label: input.active ? "Now" : "Result",
    text,
    shape: text.includes("/") && !text.includes(" ") ? "path" : "prose",
  };
}

/** The line under the title: model and effort, else the status word. */
export function no3ySubagentSpec(input: {
  readonly modelLabel: string | null;
  readonly effort: string | null;
  readonly statusLabel: string;
}): string {
  const model = input.modelLabel === "Not reported" ? null : input.modelLabel;
  return [model, input.effort].filter(Boolean).join(" · ") || input.statusLabel;
}
