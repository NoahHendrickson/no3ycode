/**
 * Live status line — see `.fork/customizations.yaml#fork-working-row-last`.
 * The working row moves to the end and absorbs the turn's latest live row; a
 * failed group's `thinking` row and approvals keep their own upstream row.
 */
import type { MessagesTimelineRow } from "~/components/chat/MessagesTimeline.logic";

type WorkingRow = Extract<MessagesTimelineRow, { kind: "working" }>;
export type ForkLiveRow = Extract<MessagesTimelineRow, { kind: "thinking" | "work-live" }>;
export type ForkStatusLineRow = WorkingRow & {
  readonly forkLive: ForkLiveRow;
  /** Picks the thinking word; it changes only when a new row or step lands. */
  readonly forkWordSeed: string;
};

// Runs on useStableRows' output, whose array and rows keep their identity
// while unchanged; these caches keep that identity through the fold.
const folded = new WeakMap<MessagesTimelineRow[], MessagesTimelineRow[]>();
const mergedByWorking = new WeakMap<WorkingRow, ForkStatusLineRow>();

// Upstream's grouped `thinking` row is the failed-tool shape, and its approval
// rows render as cards; both keep their own row.
function foldsIntoStatusLine(row: MessagesTimelineRow): row is ForkLiveRow {
  if (row.kind === "thinking") return row.groupId === undefined;
  return (
    row.kind === "work-live" &&
    row.active &&
    row.entry.projectedItem?.item.type !== "approval_request"
  );
}

// A group's id holds while it grows, so its size marks each finished tool.
function wordSeed(live: ForkLiveRow, above: MessagesTimelineRow | undefined): string {
  if (live.kind === "work-live") return live.entry.id;
  if (above === undefined) return "";
  return "groupedEntries" in above ? `${above.id}:${above.groupedEntries.length}` : above.id;
}

function mergedWorkingRow(
  working: WorkingRow,
  live: ForkLiveRow,
  forkWordSeed: string,
): ForkStatusLineRow {
  const cached = mergedByWorking.get(working);
  if (cached?.forkLive === live && cached.forkWordSeed === forkWordSeed) return cached;
  const merged = { ...working, forkLive: live, forkWordSeed };
  mergedByWorking.set(working, merged);
  return merged;
}

function fold(rows: MessagesTimelineRow[]): MessagesTimelineRow[] {
  const workingIndex = rows.findIndex((row) => row.kind === "working");
  const working = rows[workingIndex];
  if (working?.kind !== "working") return rows;
  const rest = rows.toSpliced(workingIndex, 1);
  const liveIndex = rest.findLastIndex(foldsIntoStatusLine);
  const live = rest[liveIndex];
  if (live && foldsIntoStatusLine(live)) {
    const above = rest.toSpliced(liveIndex, 1);
    return [...above, mergedWorkingRow(working, live, wordSeed(live, above.at(-1)))];
  }
  return workingIndex === rows.length - 1 ? rows : [...rest, working];
}

export function forkLiveStatusRows(rows: MessagesTimelineRow[]): MessagesTimelineRow[] {
  const cached = folded.get(rows);
  if (cached) return cached;
  const result = fold(rows);
  folded.set(rows, result);
  return result;
}

export function isForkStatusLine(row: WorkingRow): row is ForkStatusLineRow {
  return "forkLive" in row;
}

/**
 * One-line text for the folded live row; upstream's richer previews stay in the open group.
 * Null is the thinking slot, which takes a word from forkThinkingWords.
 */
export function forkStatusLineLabel(
  live: ForkLiveRow,
  activity: {
    readonly providerStartingLabel: string | null;
    readonly liveAnswerPreview: string | null;
  },
  toolLabel: string,
): string | null {
  if (live.kind === "thinking") {
    return activity.providerStartingLabel ?? live.label ?? activity.liveAnswerPreview ?? null;
  }
  return live.entry.itemType === "reasoning" ? null : toolLabel;
}
