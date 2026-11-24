import { describe, expect, it } from "vite-plus/test";

import { no3yChipPaddings } from "./no3yChipHeight";

// enriched-markdown's iOS heights: hugging code (CodeRenderer + 80a457c9) and a link pill's box
// (ENRMLinkPillAttachment boxHeight, its padding clamped at 0 by linkVariantUtils), with RCTFont
// rounding Dynamic Type sizes to a whole point. SF Pro's ratio is the measured iOS one.
const rct = (size: number, fontScale: number) =>
  fontScale !== 1 ? Math.round(size * fontScale) : size;
const codeHeight = (body: number, scale: number, fontScale: number, padding: number) =>
  1.1640625 * rct(body * scale, fontScale) + 2 * padding;
const pillHeight = (
  body: number,
  labelScale: number,
  fontScale: number,
  padding: number,
  border: number,
) => Math.ceil(1.19307 * rct(body, fontScale) * labelScale + 2 * (Math.max(0, padding) + border));

describe("no3y reply chip heights", () => {
  it("brings code, file chips and the subagent capsule to one height", () => {
    for (const body of [14, 15, 16, 17, 18, 20]) {
      for (const fontScale of [0.82, 0.88, 0.94, 1, 1.12, 1.24, 1.35, 1.65]) {
        for (const hairlineWidth of [1 / 3, 1 / 2]) {
          const paddings = no3yChipPaddings({
            bodyFontSize: body,
            chipFontScale: 0.95,
            fontScale,
            hairlineWidth,
          });
          const code = codeHeight(body, 0.95, fontScale, paddings.code);
          expect(code).toBeCloseTo(Math.round(code), 6);
          expect(pillHeight(body, 0.95, fontScale, paddings.file, 0)).toBeCloseTo(code, 6);
          expect(
            pillHeight(
              body,
              paddings.capsuleLabelScale,
              fontScale,
              paddings.capsule,
              hairlineWidth,
            ),
          ).toBeCloseTo(code, 6);
        }
      }
    }
  });

  it("matches the simulator at the default 16pt body", () => {
    const paddings = no3yChipPaddings({
      bodyFontSize: 16,
      chipFontScale: 0.95,
      fontScale: 1,
      hairlineWidth: 1 / 3,
    });
    expect(paddings.code).toBeCloseTo((19 - 1.1640625 * 15.2) / 2);
  });
});
