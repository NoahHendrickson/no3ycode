/**
 * Live checklist — see `.fork/customizations.yaml#fork-live-task-list`.
 * The current turn's latest task list, which the status line draws as a checklist above itself.
 */
import type { OrchestrationV2PlanStep } from "@t3tools/contracts";
import { createContext } from "react";
import { timelineEntryStartsResponse } from "~/components/chat/MessagesTimeline.logic";
import type { TimelineEntry } from "~/session-logic";

/** The steps of the latest task list in the current response; a steer stays in it. */
export function forkLiveTaskSteps(
  entries: ReadonlyArray<TimelineEntry>,
): ReadonlyArray<OrchestrationV2PlanStep> | null {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]!;
    if (timelineEntryStartsResponse(entry)) return null;
    if (entry.kind === "work" && entry.entry.structuredPayload?.type === "todo_list") {
      const { steps } = entry.entry.structuredPayload;
      return steps.length > 0 ? steps : null;
    }
  }
  return null;
}

export const ForkLiveTasksCtx = createContext<ReadonlyArray<OrchestrationV2PlanStep> | null>(null);
