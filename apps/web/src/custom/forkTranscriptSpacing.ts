/**
 * Even transcript spacing — see `.fork/customizations.yaml#fork-transcript-spacing`.
 * Reply text, tool rows and the live status line sit 16px apart. Each row tops up
 * the space its upper neighbour already draws, so only the short gaps grow.
 */
import type { CSSProperties } from "react";
import type { MessagesTimelineRow } from "~/components/chat/MessagesTimeline.logic";

const FORK_TRANSCRIPT_GAP = 16;

type Kind = "reply" | "work" | "live" | "other";

function kindOf(row: MessagesTimelineRow): Kind {
  switch (row.kind) {
    case "message":
      return row.message.role === "assistant" ? "reply" : "other";
    case "sent-message":
      return "reply";
    case "work":
    case "work-live":
    case "work-toggle":
    case "thinking":
      return "work";
    case "working":
      return "live";
    default:
      return "other";
  }
}

// A row's own top and bottom padding: a reply's py-0.5, and a tool row's
// WorkLogRow py-0.5 outside an expanded group's list (which draws py-0).
function ownPadding(row: MessagesTimelineRow): number {
  switch (row.kind) {
    case "message":
      return row.message.role === "assistant" ? 2 : 0;
    case "sent-message":
    case "work-live":
    case "work-toggle":
    case "thinking":
      return 2;
    case "work":
      return row.isExpandedToolGroup ? 0 : 2;
    default:
      return 0;
  }
}

// The padding below a row's content: TimelineRowContent's, or WorkLogBlock's for
// tool rows and subagent groups. Mirrors TimelineRowContent's class chain.
function outerPadding(row: MessagesTimelineRow): number {
  switch (row.kind) {
    case "work":
      if (row.continuesWorkLog) return 0;
      if (!row.isExpandedToolGroup) return 8;
      // An expanded reasoning trace is one WorkLogDetails, which adds py-1.
      return row.groupedEntries.every((entry) => entry.itemType === "reasoning") ? 4 + 4 : 4;
    case "work-live":
    case "work-toggle":
    case "thinking":
      return row.continuesWorkLog || row.expanded === true ? 0 : 8;
    case "event":
      if (row.projectedItem.item.type !== "subagent") return 8;
      // ForkSubagentGroup's tree adds py-1 inside its WorkLogBlock.
      return (row.continuesWorkLog ? 0 : 8) + 4;
    case "turn-fold":
    case "working":
      return 6;
    case "message":
      if (row.groupedWithNext) return 4;
      return row.message.role === "assistant" && !row.showAssistantMeta ? 8 : 16;
    case "worktree-setup":
    case "attempt-fold":
    case "html-render":
    case "sent-message":
    case "mcp-app":
    case "viewed-images":
      return 8;
    default:
      return 16;
  }
}

// The space above a row's content: the live line's pt-1, or the row's own padding.
function leadingSpace(row: MessagesTimelineRow, kind: Kind): number {
  return kind === "live" ? 4 : ownPadding(row);
}

/** Extra space above `row` given the row above it, or 0. */
function gapAbove(row: MessagesTimelineRow, previous: MessagesTimelineRow | undefined): number {
  if (previous === undefined) return 0;
  const kind = kindOf(row);
  const above = kindOf(previous);
  const spaced =
    kind === "live" ||
    (kind === "reply" && above === "work") ||
    (kind === "work" && above === "reply");
  if (!spaced) return 0;
  const drawn = outerPadding(previous) + ownPadding(previous) + leadingSpace(row, kind);
  return Math.max(0, FORK_TRANSCRIPT_GAP - drawn);
}

// A row whose gap changes is handed to the list as a copy, so its memoised
// content re-renders; rows whose gap holds keep their identity.
const spacedRows = new WeakMap<MessagesTimelineRow[], MessagesTimelineRow[]>();
const copies = new WeakMap<MessagesTimelineRow, MessagesTimelineRow>();
const gapOf = new WeakMap<MessagesTimelineRow, number>();

function spacedRow(row: MessagesTimelineRow, gap: number): MessagesTimelineRow {
  const copy = copies.get(row);
  if (copy && gapOf.get(copy) === gap) return copy;
  const next = { ...row };
  copies.set(row, next);
  gapOf.set(next, gap);
  return next;
}

export function forkSpaceTranscript(rows: MessagesTimelineRow[]): MessagesTimelineRow[] {
  const cached = spacedRows.get(rows);
  if (cached) return cached;
  // Most rows keep their gap; only allocate once one needs a copy.
  let result: MessagesTimelineRow[] | null = null;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    const gap = gapAbove(row, rows[index - 1]);
    const next = gap === 0 ? row : spacedRow(row, gap);
    if (next !== row && result === null) result = rows.slice(0, index);
    result?.push(next);
  }
  const spaced = result ?? rows;
  spacedRows.set(rows, spaced);
  return spaced;
}

export function forkTranscriptGapStyle(row: MessagesTimelineRow): CSSProperties | undefined {
  const gap = gapOf.get(row);
  return gap === undefined ? undefined : { paddingTop: gap };
}
