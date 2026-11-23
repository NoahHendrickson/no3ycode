/**
 * Live status line — see `.fork/customizations.yaml#fork-working-row-last`.
 * The working row moves to the end and absorbs the turn's latest thinking row;
 * a running tool keeps its own row above a Thinking line. A failed group's
 * `thinking` row keeps its own upstream row.
 */
import type { MessagesTimelineRow } from "~/components/chat/MessagesTimeline.logic";

type WorkingRow = Extract<MessagesTimelineRow, { kind: "working" }>;
type WorkLiveRow = Extract<MessagesTimelineRow, { kind: "work-live" }>;
export type ForkLiveRow = Extract<MessagesTimelineRow, { kind: "thinking" | "work-live" }>;
export type ForkStatusLineRow = WorkingRow & { readonly forkLive: ForkLiveRow };

// Runs on useStableRows' output, whose array and rows keep their identity
// while unchanged; these caches keep that identity through the fold.
const folded = new WeakMap<MessagesTimelineRow[], MessagesTimelineRow[]>();
const mergedByWorking = new WeakMap<WorkingRow, ForkStatusLineRow>();
const thinkingByWorking = new WeakMap<WorkingRow, ForkLiveRow>();
const standIns = new WeakSet<ForkLiveRow>();
const settledTools = new WeakMap<WorkLiveRow, WorkLiveRow>();

// Upstream's grouped `thinking` row is the failed-tool shape; it keeps its own row.
// Live reasoning reads "Thinking" anyway, so it folds rather than doubling the line.
function foldsIntoStatusLine(row: MessagesTimelineRow): row is ForkLiveRow {
  if (row.kind === "thinking") return row.groupId === undefined;
  return row.kind === "work-live" && row.active && row.entry.itemType === "reasoning";
}

function isRunningTool(row: MessagesTimelineRow): row is WorkLiveRow {
  return row.kind === "work-live" && row.active && row.entry.itemType !== "reasoning";
}

// Upstream keeps the latest tool as the active live row after it succeeds; out
// of the status line it would still read "Running", so it is drawn as settled.
function settledTool(row: MessagesTimelineRow): MessagesTimelineRow {
  if (!isRunningTool(row) || row.entry.toolLifecycleStatus === "inProgress") return row;
  const cached = settledTools.get(row);
  if (cached) return cached;
  const settled = { ...row, active: false };
  settledTools.set(row, settled);
  return settled;
}

function thinkingLine(working: WorkingRow): ForkLiveRow {
  const cached = thinkingByWorking.get(working);
  if (cached) return cached;
  const row: ForkLiveRow = {
    kind: "thinking",
    id: `${working.id}:fork-thinking`,
    createdAt: working.createdAt,
  };
  thinkingByWorking.set(working, row);
  standIns.add(row);
  return row;
}

function mergedWorkingRow(working: WorkingRow, live: ForkLiveRow): ForkStatusLineRow {
  const cached = mergedByWorking.get(working);
  if (cached?.forkLive === live) return cached;
  const merged = { ...working, forkLive: live };
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
    return [...rest.toSpliced(liveIndex, 1), mergedWorkingRow(working, live)];
  }
  if (rest.some(isRunningTool)) {
    return [...rest.map(settledTool), mergedWorkingRow(working, thinkingLine(working))];
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
 * The row to draw as the status line, or null for upstream's "Working for …".
 * A running tool's stand-in Thinking line gives way while the turn waits on an
 * approval or an answer: nothing is thinking then.
 */
export function forkStatusLineRow(
  row: WorkingRow,
  awaitingUser: boolean,
): ForkStatusLineRow | null {
  if (!isForkStatusLine(row)) return null;
  return awaitingUser && standIns.has(row.forkLive) ? null : row;
}

/** One-line text for the folded live row; upstream's richer previews stay in the open group. */
export function forkStatusLineLabel(
  live: ForkLiveRow,
  activity: {
    readonly providerStartingLabel: string | null;
    readonly liveAnswerPreview: string | null;
  },
): string {
  if (live.kind === "thinking") {
    return activity.providerStartingLabel ?? live.label ?? activity.liveAnswerPreview ?? "Thinking";
  }
  return "Thinking";
}
