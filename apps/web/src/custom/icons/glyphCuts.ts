// Element shapes shared by the derived filled weight (hugeiconsFill.ts) and the hand-drawn one
// (handDrawnSolids.ts), so a retuned width reaches both. Kept apart from hugeiconsFill.ts, which
// imports the hand-drawn solids: they can't import values back from it.
import type { IconSvgElement } from "./hugeiconsFill";

type Element = IconSvgElement[number];

/** At 12px a 1.5-unit cut is under a pixel, so cuts are at least 2 units wide. */
export const KNOCKOUT_WIDTH = 2;
/** Two bodies whose outlines meet (a server's stacked racks) are parted by a one-stroke seam. */
export const SEAM_WIDTH = 1.5;

export const filledBody = ([tag, attrs]: Element): Element => [
  tag,
  { ...attrs, fill: "currentColor", stroke: "none" },
];

/** Mask content: the element's outline, cut `width` wide. */
export const knockout = ([tag, attrs]: Element, width: number): Element => [
  tag,
  { ...attrs, stroke: "black", fill: "none", strokeWidth: width },
];
