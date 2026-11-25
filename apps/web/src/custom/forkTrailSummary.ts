/**
 * Trail summaries — see `.fork/customizations.yaml#fork-trail-summary`.
 * A finished stretch reads as what it did ("Read 1 file"), not as its first thought or task
 * update; both stay inside the group when it opens.
 */
import { summarizeToolGroup } from "@t3tools/client-runtime/work-log/presentation";
import { workLogEntryIsToolLike, type WorkLogEntry } from "~/session-logic";
import type { MessageResolver } from "~/i18n/messages";

export function forkTrailSummary(
  entries: ReadonlyArray<WorkLogEntry>,
  resolve: MessageResolver,
): string {
  // A task update has no count to report; upstream would call it "Received 1 update".
  const counted = entries.filter((entry) => entry.itemType !== "todo_list");
  const only = counted.length === 1 ? counted[0]! : null;
  if (counted.length === 0) return entries.at(-1)?.label ?? "";
  if (only !== null && !workLogEntryIsToolLike(only) && only.itemType !== "reasoning") {
    return only.label;
  }
  return summarizeToolGroup(counted, resolve).summary;
}
