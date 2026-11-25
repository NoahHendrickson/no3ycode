/**
 * Live status line — see `.fork/customizations.yaml#fork-working-row-last`.
 * The working row moves to the end. The live row folds into it iff it is the turn's
 * tail, so the tail is one line; a live row with a reply after it stays in place above
 * a plain Thinking line. A failed group's `thinking` row keeps its own upstream row.
 */
import {
  liveWorkEntryLabel,
  type MessagesTimelineRow,
} from "~/components/chat/MessagesTimeline.logic";
import type { MessageResolver } from "~/i18n/messages";

type WorkingRow = Extract<MessagesTimelineRow, { kind: "working" }>;
type WorkLiveRow = Extract<MessagesTimelineRow, { kind: "work-live" }>;
export type ForkLiveRow = Extract<MessagesTimelineRow, { kind: "thinking" | "work-live" }>;
/** `forkLive` is the folded live row, or null for a plain Thinking line under a tool that stays in place. */
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
const foldedWhileYielding = new WeakMap<MessagesTimelineRow[], MessagesTimelineRow[]>();
const mergedByWorking = new WeakMap<WorkingRow, ForkStatusLineRow>();
const settledTools = new WeakMap<WorkLiveRow, ForkSettledToolRow>();

const isLive = (row: MessagesTimelineRow): row is ForkLiveRow =>
  row.kind === "thinking" || (row.kind === "work-live" && row.active);

// Upstream follows the live group with its open details and thumbnails; those stay in place.
const isGroupDetail = (row: MessagesTimelineRow) =>
  (row.kind === "work" && row.isExpandedToolGroup) || row.kind === "viewed-images";

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

function fold(rows: MessagesTimelineRow[], lineYields: boolean): MessagesTimelineRow[] {
  const workingIndex = rows.findIndex((row) => row.kind === "working");
  const working = rows[workingIndex];
  if (working?.kind !== "working") return rows;
  const rest = rows.toSpliced(workingIndex, 1);
  // Upstream derives at most one live activity row, at the turn's tail.
  const liveIndex = rest.findLastIndex(isLive);
  const live = liveIndex < 0 ? undefined : (rest[liveIndex] as ForkLiveRow);
  if (
    lineYields ||
    working.compacting === true ||
    live === undefined ||
    (live.kind === "thinking" && live.groupId !== undefined)
  ) {
    return workingIndex === rows.length - 1 ? rows : [...rest, working];
  }
  const shown = live.kind === "thinking" ? live : settled(live);
  if (rest.slice(liveIndex + 1).every(isGroupDetail)) {
    const above = rest.toSpliced(liveIndex, 1);
    const seed = rowSeed(live.kind === "thinking" ? above.at(-1) : live);
    return [...above, mergedWorkingRow(working, shown, seed)];
  }
  const above = rest.toSpliced(liveIndex, 1, shown);
  return [...above, mergedWorkingRow(working, null, rowSeed(above.at(-1)))];
}

/**
 * `lineYields`: an approval, an answer, compaction or worktree setup owns the tail, so
 * upstream's rows stay as they are and the working row draws "Working for …" at the end.
 */
export function forkLiveStatusRows(
  rows: MessagesTimelineRow[],
  lineYields = false,
): MessagesTimelineRow[] {
  const cache = lineYields ? foldedWhileYielding : folded;
  const cached = cache.get(rows);
  if (cached) return cached;
  const result = fold(rows, lineYields);
  cache.set(rows, result);
  return result;
}

export function isForkStatusLine(row: WorkingRow): row is ForkStatusLineRow {
  return "forkLive" in row;
}

/**
 * One-line text for the status line; upstream's richer previews stay in the open group.
 * A running tool reads as its live row would ("Running vp"); reasoning and a settled tool
 * return null, the thinking slot, which shows forkThinkingWord.
 */
export function forkStatusLineLabel(
  live: ForkLiveRow | null,
  activity: {
    readonly providerStartingLabel: string | null;
    readonly liveAnswerPreview: string | null;
  },
  workspaceRoot: string | undefined,
  resolve?: MessageResolver,
): string | null {
  const label = live?.kind === "thinking" ? live.label : undefined;
  if (live?.kind === "work-live") {
    return live.active && live.entry.itemType !== "reasoning"
      ? liveWorkEntryLabel(live.entry, workspaceRoot, true, resolve)
      : null;
  }
  return activity.providerStartingLabel ?? label ?? activity.liveAnswerPreview ?? null;
}
