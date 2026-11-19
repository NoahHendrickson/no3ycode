/**
 * The Sidebar V2 trailing column — see
 * `.fork/customizations.yaml#sidebar-v2-row-action-hit-area`.
 *
 * One file owns what was previously spelled out at every call site: the offsets
 * that put the icon-only controls' glyphs on a single vertical axis. Their box is
 * the Storybook Button, pinned to 24px and 32px by custom/SidebarV2IconButton.
 *
 * ## The axis
 *
 * Everything trailing centres 24px in from the panel's content edge, and the
 * chrome rows are what set that number: they end at pe-3 (12px), and a 24px
 * button flush there centres its glyph 12px further — 24. Everything else in
 * the column measures itself against that centre: the hover actions on both
 * row variants, the shelf chevrons, and the project header's plus. A card's
 * status mark sits on the same trailing end (Figma 364:17299 draws it after
 * the title, not before): its 12px box is pulled 2px past the card's content
 * edge so the mark's centre lands on the axis, and the hover actions stack to
 * its left.
 *
 * The rows do NOT share a right edge, which is what makes this worth writing
 * down once. The list rows end 8px in where the chrome rows end 12; a card's
 * own px-3 closes that gap and then some, so a 24px box flush with the card's
 * content edge is already on the axis — but a box flush with a row that has
 * no such padding (a slim row's right-0 overlay) sits 4px too far right and
 * spends me-1 to get back. The project header's plus is the one 32px control
 * in the list: flush with the list's bare 8px edge, it centres 16 further —
 * 24 — and owes nothing.
 *
 * Each offset below is derived from the inset of the edge its control is
 * flush against. They are not interchangeable and none of them is a taste
 * value: change a row's padding and its offset has to be re-derived, or that
 * row's mark steps out of the column on its own.
 */
import { cn } from "~/lib/utils";

/**
 * What each row spends to reach the axis. Derived, never tuned — the comment on
 * each is the arithmetic, and the numbers only hold against the padding named.
 *
 * An empty string is a derivation, not an omission: it records that the row's
 * own geometry already lands its control on the axis, and the guard pins it so
 * a nudge cannot creep back in. Do not delete the "empty" entries — the module
 * is the derivation, and a call site with no entry has no derivation.
 */
export const SIDEBAR_V2_TRAILING_OFFSET = {
  /** Card hover actions. They sit to the left of the status mark on the
   *  title line and share its trailing edge, so nothing here — the mark's
   *  own offset is what puts the group on the axis. */
  cardActions: "",
  /** The card's status mark. Its 12px box flush with the card's content edge
   *  (list pad 8 + card px-3 = 20) centres at 26 — 2px left of the axis, and
   *  visibly so under the chrome rows' plus. -me-0.5 pulls it the 2px back.
   *  The 10px dot inside then inks 1px past the edge the meta line's text
   *  ends on, which is the optical correction a round mark wants against a
   *  flat text edge rather than a compromise. */
  cardStatus: "-me-0.5",
  /** Slim-row hover actions. The overlay is `absolute right-0`, which lands on
   *  the row's border box — the list's 8px inset, padding notwithstanding — so
   *  a flush 24px button centres at 20. me-1 walks it the 4px back. */
  slimActions: "me-1",
  /** The project header's plus. A 32px button (Figma 364:11451) flush with
   *  the list's bare 8px edge centres 16px further — 24 exactly. Nothing
   *  owed; the size is what a 24px box spent me-1 to fake. */
  headerPlus: "",
  /** Shelf header chevrons. px-2.5 on the shelf button makes an 18px inset,
   *  and a flush 12px glyph centres 6px further — 24 exactly. Nothing owed. */
  shelfChevron: "",
  /** The chrome rows' trailing inset — the pe-3 that defines the axis. The
   *  24px button is flush with it, so nothing here either. */
  chromeRow: "",
  /** The Automations row's status mark. Its 12px status box flush with the
   *  chrome button's px-3 (row inset 8 + 12 = 20) centres at 26, 2px left of
   *  the Threads gear beneath it. -me-0.5 pulls it the 2px back. Its own key,
   *  not cardStatus: the two rest on different padding. */
  chromeStatus: "-me-0.5",
  /** The status section header's caret. Its 14px glyph flush with the
   *  header's px-3 (list pad 8 + 12 = 20) centres at 27, 3px left of the card
   *  status marks beneath it. -me-0.75 pulls it the 3px back. */
  statusCaret: "-me-0.75",
} as const;

/**
 * The three slim-row actions — settle, un-settle, wake — are one control in
 * three branches of a ternary, differing only in label, icon and handler. They
 * were three copies of this string; the copies are how the set drifted apart
 * the first time.
 *
 * Placement and reveal for the slim-row action (custom/SidebarV2IconButton's
 * SidebarV2SlimRowAction). Absolutely positioned rather than in flow, which is also why slim rows never
 * had the card's paint-order bug: an opacity-induced stacking context on the
 * time label they swap with lands in the same layer as this button, and DOM
 * order decides.
 */
export const SIDEBAR_V2_SLIM_ROW_ACTION_CLASS = cn(
  "absolute inset-y-0 right-0 opacity-0 focus-visible:opacity-100 group-any-hover/v2-row:opacity-100",
  // With no hovering pointer at all nothing reveals it, so it must not take
  // taps either: its 44px coarse hit area sat invisibly over the time label
  // and a tap meant to open the thread woke or un-settled it. Long-press opens
  // the row menu instead. A trackpad on a touch-primary iPad still hovers it
  // in, so it keeps its clicks there.
  "[@media(any-hover:none)]:pointer-events-none",
  SIDEBAR_V2_TRAILING_OFFSET.slimActions,
);
