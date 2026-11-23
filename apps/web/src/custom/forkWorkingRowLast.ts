/**
 * Live status line — see `.fork/customizations.yaml#fork-working-row-last`.
 * The working row moves to the end. It absorbs the turn's live thinking row or
 * live reasoning; a running tool keeps its own row above a plain Thinking line.
 * A failed group's `thinking` row keeps its own upstream row.
 */
import type { MessagesTimelineRow } from "~/components/chat/MessagesTimeline.logic";

type WorkingRow = Extract<MessagesTimelineRow, { kind: "working" }>;
type WorkLiveRow = Extract<MessagesTimelineRow, { kind: "work-live" }>;
export type ForkLiveRow = Extract<MessagesTimelineRow, { kind: "thinking" | "work-live" }>;
/** `forkLive` is the folded live row, or null for a plain Thinking line under a running tool. */
export type ForkStatusLineRow = WorkingRow & {
  readonly forkLive: ForkLiveRow | null;
  /** Picks the thinking word (forkThinkingWord); it changes only when a new row or step lands. */
  readonly forkWordSeed: string;
};
/** A finished tool upstream still holds as the live row, drawn settled. */
type ForkSettledToolRow = WorkLiveRow & { readonly forkSettled: true };

// Runs on useStableRows' output, whose array and rows keep their identity
// while unchanged; these caches keep that identity through the fold.
const folded = new WeakMap<MessagesTimelineRow[], MessagesTimelineRow[]>();
const mergedByWorking = new WeakMap<WorkingRow, ForkStatusLineRow>();
const settledTools = new WeakMap<WorkLiveRow, ForkSettledToolRow>();

const isLive = (row: MessagesTimelineRow): row is ForkLiveRow =>
  row.kind === "thinking" || (row.kind === "work-live" && row.active);

// Upstream keeps the latest tool as the active live row after it succeeds; out of
// the status line it would still read "Running". Only an end status settles it:
// upstream counts an entry with no status as running (workEntryIsActiveTurnActivity).
function settled(row: WorkLiveRow): WorkLiveRow {
  const status = row.entry.toolLifecycleStatus;
  if (status === undefined || status === "inProgress") return row;
  const cached = settledTools.get(row);
  if (cached) return cached;
  const next = { ...row, active: false, forkSettled: true as const };
  settledTools.set(row, next);
  return next;
}

export function isForkSettledTool(row: MessagesTimelineRow): boolean {
  return "forkSettled" in row;
}

// A group's id holds while it grows, so its newest entry marks each new tool.
function rowSeed(row: MessagesTimelineRow | undefined): string {
  if (row?.kind === "work-live") return row.entry.id;
  if (row?.kind === "work") return row.groupedEntries.at(-1)?.id ?? row.id;
  return row?.id ?? "";
}

function mergedWorkingRow(
  working: WorkingRow,
  live: ForkLiveRow | null,
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
  // Upstream derives at most one live activity row, at the turn's tail.
  const liveIndex = rest.findLastIndex(isLive);
  const live = liveIndex < 0 ? undefined : (rest[liveIndex] as ForkLiveRow);
  if (live === undefined || (live.kind === "thinking" && live.groupId !== undefined)) {
    return workingIndex === rows.length - 1 ? rows : [...rest, working];
  }
  if (live.kind === "thinking" || live.entry.itemType === "reasoning") {
    const above = rest.toSpliced(liveIndex, 1);
    const seed = live.kind === "work-live" ? live.entry.id : rowSeed(above.at(-1));
    return [...above, mergedWorkingRow(working, live, seed)];
  }
  const above = rest.toSpliced(liveIndex, 1, settled(live));
  return [...above, mergedWorkingRow(working, null, rowSeed(above.at(-1)))];
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
 * The row to draw as the status line, or null for upstream's "Working for …":
 * while the turn waits on an approval or an answer, nothing is thinking.
 */
export function forkStatusLineRow(
  row: WorkingRow,
  awaitingUser: boolean,
): ForkStatusLineRow | null {
  return isForkStatusLine(row) && !awaitingUser ? row : null;
}

/**
 * One-line text for the status line; upstream's richer previews stay in the open group.
 * Null is the thinking slot, which shows forkThinkingWord.
 */
export function forkStatusLineLabel(
  live: ForkLiveRow | null,
  activity: {
    readonly providerStartingLabel: string | null;
    readonly liveAnswerPreview: string | null;
  },
): string | null {
  const label = live?.kind === "thinking" ? live.label : undefined;
  if (live?.kind === "work-live") return null;
  return activity.providerStartingLabel ?? label ?? activity.liveAnswerPreview ?? null;
}
