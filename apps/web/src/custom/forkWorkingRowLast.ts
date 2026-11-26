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
import { forkThinkingWord } from "@t3tools/shared/forkThinkingWords";
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

/** What the status line can say; ForkLiveStatusLine rotates between them. */
export interface ForkStatusLineVoices {
  /** Holds the line alone: a provider startup, or waiting on subagents. */
  readonly pinned: string | null;
  /** The running tool as its live row would read it ("Running vp"). */
  readonly tool: { readonly key: string; readonly label: string } | null;
  /** Zen's preview: the heading or first sentence of the latest reply or thinking trace. */
  readonly thought: string | null;
}

export type ForkStatusVoice = "thought" | "tool" | "word";

export function forkStatusLineVoices(
  live: ForkLiveRow | null,
  activity: {
    readonly providerStartingLabel: string | null;
    readonly liveAnswerPreview: string | null;
  },
  workspaceRoot: string | undefined,
  resolve?: MessageResolver,
): ForkStatusLineVoices {
  const runningTool =
    live?.kind === "work-live" && live.active && live.entry.itemType !== "reasoning"
      ? live.entry
      : null;
  return {
    pinned:
      activity.providerStartingLabel ?? (live?.kind === "thinking" ? live.label : null) ?? null,
    tool:
      runningTool === null
        ? null
        : {
            key: runningTool.id,
            label: liveWorkEntryLabel(runningTool, workspaceRoot, true, resolve),
          },
    // A status, not a sentence: drop one closing period, keep an ellipsis, ? and !.
    thought: activity.liveAnswerPreview?.replace(/(?<![.])[.。]$/u, "") || null,
  };
}

const VOICE_ORDER: ReadonlyArray<ForkStatusVoice> = ["thought", "tool", "word"];

/** Which voice holds the line, and what it last saw of the others. */
export interface ForkStatusLineState {
  readonly toolKey: string | null;
  readonly thought: string | null;
  readonly voice: ForkStatusVoice;
  /** Bumped whenever a voice takes the line between beats; it restarts the beat. */
  readonly arrival: number;
  /** Counts the word's turns, so each turn shows a fresh word. */
  readonly lap: number;
}

function speaks(line: ForkStatusLineState, voice: ForkStatusVoice): boolean {
  return voice === "word" || (voice === "tool" ? line.toolKey !== null : line.thought !== null);
}

/** One beat: the next voice after the one showing that has something to say. */
export function forkStatusLineAdvance(line: ForkStatusLineState): ForkStatusLineState {
  const from = VOICE_ORDER.indexOf(line.voice);
  for (let step = 1; step <= VOICE_ORDER.length; step += 1) {
    const voice = VOICE_ORDER[(from + step) % VOICE_ORDER.length]!;
    if (speaks(line, voice)) {
      return { ...line, voice, lap: voice === "word" ? line.lap + 1 : line.lap };
    }
  }
  return line;
}

export function forkStatusLineStart(voices: ForkStatusLineVoices): ForkStatusLineState {
  return {
    toolKey: voices.tool?.key ?? null,
    thought: voices.thought,
    voice: voices.tool !== null ? "tool" : voices.thought !== null ? "thought" : "word",
    arrival: 0,
    lap: 0,
  };
}

/**
 * Brings the line up to date in render. A new tool or thought takes it at once; the voice
 * showing going quiet hands back to the thought, else moves on. Either starts a fresh beat.
 * Returns `line` if unchanged.
 */
export function forkStatusLineReconcile(
  line: ForkStatusLineState,
  voices: ForkStatusLineVoices,
): ForkStatusLineState {
  const toolKey = voices.tool?.key ?? null;
  if (toolKey === line.toolKey && voices.thought === line.thought) return line;
  const seen = { ...line, toolKey, thought: voices.thought };
  // A thought still streaming only grows; it is the same arrival, not a new one per token.
  const grew = line.thought !== null && voices.thought?.startsWith(line.thought) === true;
  const arrived: ForkStatusVoice | null =
    toolKey !== null && toolKey !== line.toolKey
      ? "tool"
      : voices.thought !== null && voices.thought !== line.thought && !grew
        ? "thought"
        : null;
  if (arrived !== null) return { ...seen, voice: arrived, arrival: line.arrival + 1 };
  if (speaks(seen, seen.voice)) return seen;
  // A tool that ends between beats returns the line to the update it was part of.
  const next =
    seen.voice !== "thought" && speaks(seen, "thought")
      ? { ...seen, voice: "thought" as const }
      : forkStatusLineAdvance(seen);
  return { ...next, arrival: line.arrival + 1 };
}

/** Whether the line needs a beat: nothing pins it and it has more than the word to say. */
export function forkStatusLineRotates(voices: ForkStatusLineVoices): boolean {
  return voices.pinned === null && (voices.tool !== null || voices.thought !== null);
}

/** What the line says: a pinned label, else the voice showing; each lap gets a fresh word. */
export function forkStatusLineText(
  voices: ForkStatusLineVoices,
  line: ForkStatusLineState,
  wordSeed: string,
): string {
  if (voices.pinned !== null) return voices.pinned;
  if (line.voice === "tool" && voices.tool !== null) return voices.tool.label;
  if (line.voice === "thought" && voices.thought !== null) return voices.thought;
  return forkThinkingWord(line.lap === 0 ? wordSeed : `${wordSeed}:${line.lap}`);
}

/** The label on the line, held for a dwell so a burst of arrivals never flickers through. */
export interface ForkStatusLineDwell {
  readonly label: string;
  /** The label is the thought voice, which may grow through its dwell while it streams. */
  readonly thought: boolean;
  readonly dwelling: boolean;
  /** Bumped by each label that takes the line; its dwell ends only its own hold. */
  readonly arrival: number;
}

export function forkStatusLineDwellStart(label: string, thought: boolean): ForkStatusLineDwell {
  return { label, thought, dwelling: true, arrival: 0 };
}

/**
 * A new label waits out the dwell of the one showing, then takes the line with a dwell of its
 * own. A thought that only grows passes through on its first deadline. Returns `shown` if unchanged.
 */
export function forkStatusLineDwellReconcile(
  shown: ForkStatusLineDwell,
  label: string,
  thought: boolean,
): ForkStatusLineDwell {
  if (label === shown.label) return shown;
  if (thought && shown.thought && label.startsWith(shown.label)) return { ...shown, label };
  if (shown.dwelling) return shown;
  return { label, thought, dwelling: true, arrival: shown.arrival + 1 };
}

export function forkStatusLineDwellEnd(
  shown: ForkStatusLineDwell,
  arrival: number,
): ForkStatusLineDwell {
  return shown.arrival === arrival && shown.dwelling ? { ...shown, dwelling: false } : shown;
}
