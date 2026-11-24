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
export const NO3Y_INLINE_CODE_CHIP = { radius: 5, paddingHorizontal: 6 } as const;

/** How far a footer row shifts so its outer glyph, not the button around it, meets the text edge. */
export const NO3Y_MESSAGE_ACTION_INSET =
  (NO3Y_MESSAGE_ACTION_SIZE.button - NO3Y_MESSAGE_ACTION_SIZE.icon) / 2;

/** Tool-row labels and thinking text at the reply's paragraph size: MOBILE_TYPOGRAPHY.body, which the sizing below reads. */
export const NO3Y_WORK_TEXT_CLASS = "text-base";

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

/**
 * `work-block` is a tool row that keeps its own `mb-1`; `work` has none. `user-grouped` is a
 * prompt sitting close to its own response (`mb-1` instead of `mb-2`). `fold` is a turn's
 * "Worked for" row, live or settled, so its spacing holds when the turn settles.
 */
export type No3yRowKind =
  | "reply"
  | "user"
  | "user-grouped"
  | "work"
  | "work-block"
  | "fold"
  | "live"
  | "other";

export interface No3yRowGap {
  readonly top: number;
  readonly bottom: number;
  /** Before a fold, the margin under a reply's copy and fork footer in place of its `mb-5`; it
   * applies only when the reply draws that footer. */
  readonly footer?: number;
}

type SpacedRow = ThreadFeedRow & {
  readonly userMessageGrouping?: { readonly groupedWithNext: boolean };
};

export function no3yRowKind(row: SpacedRow): No3yRowKind {
  if (row.id === NO3Y_LIVE_ROW_ID) return "live";
  switch (row.type) {
    case "message":
      if (row.message.role === "user") {
        return row.userMessageGrouping?.groupedWithNext ? "user-grouped" : "user";
      }
      // A reply with no text or attachments yet renders nothing, so it takes no gap.
      return row.message.role === "assistant" &&
        (row.message.text.trim() !== "" || (row.message.attachments?.length ?? 0) > 0)
        ? "reply"
        : "other";
    case "run-fold":
      return "fold";
    case "work-toggle":
    case "thinking":
      return "work";
    case "activity-group":
      return row.continuesWorkLog ? "work" : "work-block";
    default:
      return "other";
  }
}

// The bottom margin each kind already draws: replies mb-1, user bubbles mb-2 (mb-1 grouped),
// WorkLogBlock mb-1. A reply with its footer draws mb-5, but it ends a turn, so no tool row or
// live line follows it.
const TRAILING_SPACE: Record<No3yRowKind, number> = {
  reply: 4,
  user: 8,
  "user-grouped": 4,
  work: 0,
  "work-block": 4,
  fold: 0,
  live: 0,
  other: 0,
};

const isWork = (kind: No3yRowKind | undefined) => kind === "work" || kind === "work-block";

// "Worked for" sits midway between the turn above and its reply: 27pt of space to the footer's glyphs
// above and to the reply's text below, as measured on an iPhone at the default text size.
const FOOTER_BEFORE_FOLD = 6;
const REPLY_AFTER_FOLD = 3;

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
    if (kind === "reply" && previous === "fold") top = REPLY_AFTER_FOLD;
    if (kind === "reply" && next === "fold") return { top, bottom, footer: FOOTER_BEFORE_FOLD };
    return top > 0 || bottom > 0 ? { top, bottom } : null;
  });
}

/**
 * Hands the list a copy of each row whose gap changed, carrying the gap, so a row re-renders when
 * a neighbour arrives (rows that already have their gap keep their identity).
 */
export function createNo3yTranscriptSpacing() {
  const copies = new WeakMap<object, unknown>();
  return <Row extends SpacedRow>(
    rows: ReadonlyArray<Row>,
  ): ReadonlyArray<Row & { readonly no3yGap?: No3yRowGap }> => {
    const rowGaps = no3yTranscriptGaps(rows.map(no3yRowKind));
    return rows.map((row, index) => {
      const gap = rowGaps[index];
      if (!gap) return row;
      const copy = copies.get(row) as (Row & { readonly no3yGap: No3yRowGap }) | undefined;
      if (
        copy?.no3yGap.top === gap.top &&
        copy.no3yGap.bottom === gap.bottom &&
        copy.no3yGap.footer === gap.footer
      ) {
        return copy;
      }
      const next = { ...row, no3yGap: gap };
      copies.set(row, next);
      return next;
    });
  };
}
