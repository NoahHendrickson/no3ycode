/**
 * One height for every chip in a no3y reply on iOS — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 * enriched-markdown draws hugging inline code as Menlo's ascender + descender plus its padding, and
 * a link pill as its label font's (the system font) plus padding and border, rounded up to a whole
 * point. Each gets the padding that brings it to the tallest of them.
 */

const SYSTEM_TEXT_BOX = 1.1931;
const MENLO_TEXT_BOX = 1.1640625;
// Keeps a pill's own ceil() under the target despite small errors in these ratios.
const CEIL_SLACK = 0.05;
/** The subagent capsule's label sits this far under the code chip's scale. */
const CAPSULE_LABEL_INSET = 0.05;

/** React Native's RCTFont rounds a Dynamic Type-scaled size to a whole point. */
function rctFontSize(size: number, fontScale: number): number {
  return fontScale > 0 && fontScale !== 1 ? Math.round(size * fontScale) : size;
}

export function no3yChipPaddings(input: {
  readonly bodyFontSize: number;
  readonly chipFontScale: number;
  readonly fontScale: number;
  /** The capsule's border. */
  readonly hairlineWidth: number;
}) {
  const { bodyFontSize, chipFontScale, fontScale, hairlineWidth } = input;
  const body = rctFontSize(bodyFontSize, fontScale);
  const capsuleLabelScale = chipFontScale - CAPSULE_LABEL_INSET;
  const codeBox = MENLO_TEXT_BOX * rctFontSize(bodyFontSize * chipFontScale, fontScale);
  const fileBox = SYSTEM_TEXT_BOX * body * chipFontScale;
  const capsuleBox = SYSTEM_TEXT_BOX * body * capsuleLabelScale + 2 * hairlineWidth;
  const height = Math.ceil(Math.max(codeBox, fileBox, capsuleBox));
  // enriched-markdown clamps pill padding at 0; no pill box exceeds the height, so none needs less.
  const pill = (box: number) => Math.max(0, (height - box - CEIL_SLACK) / 2);
  return {
    code: (height - codeBox) / 2,
    file: pill(fileBox),
    capsule: pill(capsuleBox),
    capsuleLabelScale,
  };
}
