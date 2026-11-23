/**
 * Even spacing between the no3y transcript's reply text, its tool rows, and the live status line
 * — see `.fork/customizations.yaml#no3y-mobile-redesign`. Tool rows have fixed list sizes, so
 * the space goes on the measured neighbours: a reply takes it above and below, the live line above.
 */
import type { ThreadFeedRow } from "../src/features/threads/pending-thread-feed";
import { scaledTypographyLineHeight } from "../src/lib/appearancePreferences";
import { deriveThreadWorkLogSizing, THREAD_WORK_ROW_MIN_HEIGHT } from "../src/lib/layout";
import { MOBILE_TYPOGRAPHY } from "../src/lib/typography";
import { NO3Y_LIVE_ROW_ID } from "./no3yLiveStatus";

export const NO3Y_TRANSCRIPT_GAP = 16;

/** Copy and fork under a message, a step up from upstream's 28pt button and 13pt glyph. */
export const NO3Y_MESSAGE_ACTION_SIZE = { button: 32, icon: 16 } as const;

/** Inline code's chip in a reply: rounder than the native 2pt default, with room either side. */
export const NO3Y_INLINE_CODE_CHIP = { radius: 5, paddingHorizontal: 4 } as const;

/** How far a footer row shifts so its outer glyph, not the button around it, meets the text edge. */
export const NO3Y_MESSAGE_ACTION_INSET =
  (NO3Y_MESSAGE_ACTION_SIZE.button - NO3Y_MESSAGE_ACTION_SIZE.icon) / 2;

/** Tool rows set in the reply's body size, so a row only locks to its fixed height when body text fits. */
export function deriveNo3yWorkRowSizing(input: {
  readonly baseFontSize: number;
  readonly fontScale: number;
}) {
  const sizing = deriveThreadWorkLogSizing(input);
  const lineHeight = scaledTypographyLineHeight(MOBILE_TYPOGRAPHY.body, input.baseFontSize);
  return {
    ...sizing,
    estimatedRowHeight: Math.max(
      THREAD_WORK_ROW_MIN_HEIGHT,
      Math.ceil(lineHeight * input.fontScale),
    ),
    fixedRowHeight:
      input.fontScale <= 1 && lineHeight <= THREAD_WORK_ROW_MIN_HEIGHT
        ? THREAD_WORK_ROW_MIN_HEIGHT
        : undefined,
  };
}

/** `work-block` is a tool row that keeps its own `mb-1`; `work` has none. */
export type No3yRowKind = "reply" | "user" | "work" | "work-block" | "live" | "other";

export interface No3yRowGap {
  readonly top: number;
  readonly bottom: number;
}

export function no3yRowKind(row: ThreadFeedRow): No3yRowKind {
  if (row.id === NO3Y_LIVE_ROW_ID) return "live";
  switch (row.type) {
    case "message":
      return row.message.role === "assistant"
        ? "reply"
        : row.message.role === "user"
          ? "user"
          : "other";
    case "work-toggle":
    case "thinking":
      return "work";
    case "activity-group":
      return row.continuesWorkLog ? "work" : "work-block";
    default:
      return "other";
  }
}

// The bottom margin each kind already draws: replies mb-1, user bubbles mb-2, WorkLogBlock mb-1.
const TRAILING_SPACE: Record<No3yRowKind, number> = {
  reply: 4,
  user: 8,
  work: 0,
  "work-block": 4,
  live: 0,
  other: 0,
};

const isWork = (kind: No3yRowKind | undefined) => kind === "work" || kind === "work-block";

/** The extra space above and below each row, topping up what its neighbour already draws. */
export function no3yTranscriptGaps(kinds: ReadonlyArray<No3yRowKind>): Array<No3yRowGap | null> {
  return kinds.map((kind, index) => {
    const previous = kinds[index - 1];
    const next = kinds[index + 1];
    const topUp = (above: No3yRowKind) => Math.max(0, NO3Y_TRANSCRIPT_GAP - TRAILING_SPACE[above]);
    let top = 0;
    let bottom = 0;
    if (kind === "live" && previous !== undefined) top = topUp(previous);
    if (kind === "reply" && previous !== undefined && isWork(previous)) top = topUp(previous);
    if (kind === "reply" && isWork(next)) bottom = topUp("reply");
    return top > 0 || bottom > 0 ? { top, bottom } : null;
  });
}

/**
 * Hands the list a copy of each row whose gap changed, so a row re-renders when a neighbour
 * arrives (rows that already have their gap keep their identity).
 */
export function createNo3yTranscriptSpacing() {
  const copies = new WeakMap<ThreadFeedRow, ThreadFeedRow>();
  const gaps = new WeakMap<ThreadFeedRow, No3yRowGap>();
  const space = <Row extends ThreadFeedRow>(rows: ReadonlyArray<Row>): ReadonlyArray<Row> => {
    const rowGaps = no3yTranscriptGaps(rows.map(no3yRowKind));
    return rows.map((row, index) => {
      const gap = rowGaps[index];
      if (!gap) return row;
      const copy = copies.get(row) as Row | undefined;
      const current = copy ? gaps.get(copy) : undefined;
      if (copy && current?.top === gap.top && current.bottom === gap.bottom) return copy;
      const next = { ...row };
      copies.set(row, next);
      gaps.set(next, gap);
      return next;
    });
  };
  return { space, gapOf: (row: ThreadFeedRow): No3yRowGap | null => gaps.get(row) ?? null };
}
