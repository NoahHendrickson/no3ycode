import { describe, expect, it } from "vite-plus/test";

import { DITHER_CELLS, ditherLayout } from "./basicNewAgentDither";

const gapCentre = (box: { width: number }, layout: { cell: number; left: number }) =>
  (box.width / 2 - layout.left) / layout.cell;

describe("ditherLayout", () => {
  it("draws the Figma kit's crop in a MacBook-sized column", () => {
    expect(ditherLayout({ width: 1184, height: 900 }, 2)).toEqual({ cell: 2, left: -544 });
  });

  it("keeps the gap behind the headline in a narrow column", () => {
    const box = { width: 390, height: 844 };
    const layout = ditherLayout(box, 3);
    expect(layout.cell).toBe(2);
    expect(gapCentre(box, layout)).toBeCloseTo(606, 0);
  });

  it("grows the cells for a wide column rather than leaving the headline on a drape", () => {
    const box = { width: 1600, height: 900 };
    const layout = ditherLayout(box, 2);
    expect(layout.cell).toBeGreaterThan(2);
    // Still covering the right edge, with the centre inside the gap (533..679).
    expect(layout.left + DITHER_CELLS.width * layout.cell).toBeGreaterThanOrEqual(box.width);
    expect(gapCentre(box, layout)).toBeGreaterThan(533);
    expect(gapCentre(box, layout)).toBeLessThan(679);
  });

  it("reaches the foot of a tall column", () => {
    const layout = ditherLayout({ width: 1184, height: 1300 }, 2);
    expect(DITHER_CELLS.height * layout.cell).toBeGreaterThanOrEqual(1300);
  });

  it("keeps cells whole in device pixels at fractional scales", () => {
    for (const dpr of [1, 1.25, 1.5, 2.2]) {
      const { cell, left } = ditherLayout({ width: 1184, height: 900 }, dpr);
      expect(Number.isInteger(Math.round(cell * dpr * 1e9) / 1e9), String(dpr)).toBe(true);
      expect(Number.isInteger(Math.round(left * dpr * 1e9) / 1e9), String(dpr)).toBe(true);
    }
  });
});
