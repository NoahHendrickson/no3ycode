/**
 * Even transcript spacing — see `.fork/customizations.yaml#fork-transcript-spacing`.
 * Reply text, tool rows and the live status line sit 24px apart. Each row tops up
 * the space its upper neighbour already draws, so only the short gaps grow.
 */
import type { CSSProperties } from "react";
import type { MessagesTimelineRow } from "~/components/chat/MessagesTimeline.logic";

const FORK_TRANSCRIPT_GAP = 24;

type Spacing = "reply" | "work" | "live" | "other";

/** What a row already draws above and below its content, and how it is spaced. */
interface Box {
  readonly spacing: Spacing;
  readonly top: number;
  readonly bottom: number;
}

type SpacedRow = MessagesTimelineRow & { readonly forkGapTop: number };

// Mirrors upstream's paddings, each pinned by the fork-transcript-spacing guard:
// TimelineRowContent's pb-* chain, WorkLogBlock's pb-*, a reply's or ungrouped
// WorkLogRow's py-0.5, a reasoning trace's and subagent tree's py-1, the line's pt-1.
function boxOf(row: MessagesTimelineRow): Box {
  switch (row.kind) {
    case "message": {
      const outer = row.groupedWithNext
        ? 4
        : row.message.role === "assistant" && !row.showAssistantMeta
          ? 8
          : 16;
      return row.message.role === "assistant"
        ? { spacing: "reply", top: 2, bottom: outer + 2 }
        : { spacing: "other", top: 0, bottom: outer };
    }
    case "sent-message":
      return { spacing: "reply", top: 2, bottom: 8 + 2 };
    case "work": {
      const block = row.continuesWorkLog ? 0 : row.isExpandedToolGroup ? 4 : 8;
      if (!row.isExpandedToolGroup) return { spacing: "work", top: 2, bottom: block + 2 };
      // An expanded group's list draws py-0; a reasoning trace is one py-1 WorkLogDetails.
      const trace = row.groupedEntries.every((entry) => entry.itemType === "reasoning") ? 4 : 0;
      return { spacing: "work", top: 0, bottom: block + trace };
    }
    case "work-live":
    case "work-toggle":
    case "thinking":
      return {
        spacing: "work",
        top: 2,
        bottom: (row.continuesWorkLog || row.expanded === true ? 0 : 8) + 2,
      };
    case "working":
      // The fold leaves it last, so nothing reads its bottom.
      return { spacing: "live", top: 4, bottom: 0 };
    case "event":
      return row.projectedItem.item.type === "subagent"
        ? { spacing: "other", top: 4, bottom: (row.continuesWorkLog ? 0 : 8) + 4 }
        : { spacing: "other", top: 0, bottom: 8 };
    case "turn-fold":
      return { spacing: "other", top: 0, bottom: 6 };
    case "worktree-setup":
    case "attempt-fold":
    case "html-render":
    case "mcp-app":
    case "viewed-images":
      return { spacing: "other", top: 0, bottom: 8 };
    default:
      return { spacing: "other", top: 0, bottom: 16 };
  }
}

function gapAbove(row: MessagesTimelineRow, previous: MessagesTimelineRow | undefined): number {
  if (previous === undefined) return 0;
  const below = boxOf(row);
  const above = boxOf(previous);
  const spaced =
    below.spacing === "live" ||
    (below.spacing === "reply" && above.spacing === "work") ||
    (below.spacing === "work" && above.spacing === "reply");
  return spaced ? Math.max(0, FORK_TRANSCRIPT_GAP - (above.bottom + below.top)) : 0;
}

// A row whose gap changes is handed to the list as a copy, so its memoised
// content re-renders; rows whose gap holds keep their identity.
const spacedRows = new WeakMap<MessagesTimelineRow[], MessagesTimelineRow[]>();
const copies = new WeakMap<MessagesTimelineRow, SpacedRow>();

function spacedRow(row: MessagesTimelineRow, gap: number): SpacedRow {
  const copy = copies.get(row);
  if (copy?.forkGapTop === gap) return copy;
  const next = { ...row, forkGapTop: gap };
  copies.set(row, next);
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
  return "forkGapTop" in row ? { paddingTop: (row as SpacedRow).forkGapTop } : undefined;
}
