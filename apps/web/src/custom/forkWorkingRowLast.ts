/**
 * Live status line — see `.fork/customizations.yaml#fork-working-row-last`.
 * The working row moves to the end and absorbs the live row above it; a failed
 * or approval live row keeps its own upstream row.
 */
import type { MessagesTimelineRow } from "~/components/chat/MessagesTimeline.logic";
import { workEntryDisplayIndicatesToolFailure } from "~/session-logic";

type WorkingRow = Extract<MessagesTimelineRow, { kind: "working" }>;
export type ForkLiveRow = Extract<MessagesTimelineRow, { kind: "thinking" | "work-live" }>;

// Runs on useStableRows' output, whose array and rows keep their identity
// while unchanged; these caches keep that identity through the fold.
const folded = new WeakMap<MessagesTimelineRow[], MessagesTimelineRow[]>();
const mergedByWorking = new WeakMap<WorkingRow, { live: ForkLiveRow; merged: WorkingRow }>();
const liveByMerged = new WeakMap<WorkingRow, ForkLiveRow>();

function foldsIntoStatusLine(row: MessagesTimelineRow | undefined): row is ForkLiveRow {
  if (row?.kind === "thinking") return true;
  if (row?.kind !== "work-live" || !row.active) return false;
  return (
    row.entry.projectedItem?.item.type !== "approval_request" &&
    !workEntryDisplayIndicatesToolFailure(row.entry)
  );
}

// An open group's details and viewed images stay above the line that toggles them.
function trailsLiveGroup(row: MessagesTimelineRow | undefined): boolean {
  return (row?.kind === "work" && row.isExpandedToolGroup) || row?.kind === "viewed-images";
}

function mergedWorkingRow(working: WorkingRow, live: ForkLiveRow): WorkingRow {
  const cached = mergedByWorking.get(working);
  if (cached?.live === live) return cached.merged;
  const merged = { ...working };
  mergedByWorking.set(working, { live, merged });
  liveByMerged.set(merged, live);
  return merged;
}

export function forkLiveStatusRows(rows: MessagesTimelineRow[]): MessagesTimelineRow[] {
  const cached = folded.get(rows);
  if (cached) return cached;
  const index = rows.findIndex((row) => row.kind === "working");
  let result = rows;
  if (index >= 0) {
    const working = rows[index] as WorkingRow;
    const rest = rows.toSpliced(index, 1);
    let liveIndex = rest.length - 1;
    while (liveIndex >= 0 && trailsLiveGroup(rest[liveIndex])) liveIndex -= 1;
    const live = rest[liveIndex];
    const folds =
      foldsIntoStatusLine(live) &&
      rest
        .slice(liveIndex + 1)
        .every((row) => live.groupId !== undefined && row.id.startsWith(`${live.groupId}:`));
    result =
      folds && live
        ? [...rest.toSpliced(liveIndex, 1), mergedWorkingRow(working, live)]
        : index === rows.length - 1
          ? rows
          : [...rest, working];
  }
  folded.set(rows, result);
  return result;
}

/** The live row a working row stands in for, if it absorbed one. */
export function forkStatusLineLiveRow(row: WorkingRow): ForkLiveRow | undefined {
  return liveByMerged.get(row);
}
