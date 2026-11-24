import { describe, expect, it } from "vite-plus/test";

import { no3yChipSizes } from "./no3yChipHeight";

// enriched-markdown's iOS heights: hugging code (CodeRenderer + 80a457c9) and a link pill's box
// (ENRMLinkPillAttachment boxHeight, its padding clamped at 0 by linkVariantUtils), with RCTFont
// rounding Dynamic Type sizes to a whole point. SF Pro's ratio is the one measured on iOS.
const rct = (size: number, fontScale: number) =>
  fontScale !== 1 ? Math.round(size * fontScale) : size;
const pillHeight = (
  body: number,
  fontScale: number,
  pill: { readonly paddingVertical: number; readonly fontScale: number },
  border: number,
) =>
  Math.ceil(
    1.19307 * rct(body, fontScale) * pill.fontScale +
      2 * (Math.max(0, pill.paddingVertical) + border),
  );

describe("no3y reply chip heights", () => {
  it("brings code, file chips and the subagent capsule to one whole-point height", () => {
    for (const body of [14, 15, 16, 17, 18, 20]) {
      for (const fontScale of [0.82, 0.88, 0.94, 1, 1.12, 1.24, 1.35, 1.65]) {
        for (const hairlineWidth of [1 / 3, 1 / 2]) {
          const sizes = no3yChipSizes({
            bodyFontSize: body,
            chipFontScale: 0.95,
            fontScale,
            hairlineWidth,
          });
          const code = 1.1640625 * rct(body * 0.95, fontScale) + 2 * sizes.code.paddingVertical;
          expect(code).toBeCloseTo(Math.round(code), 6);
          expect(pillHeight(body, fontScale, sizes.file, 0)).toBeCloseTo(code, 6);
          expect(pillHeight(body, fontScale, sizes.capsule, hairlineWidth)).toBeCloseTo(code, 6);
        }
      }
    }
  });
});
