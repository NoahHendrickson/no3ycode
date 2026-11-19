import { describe, expect, it } from "vite-plus/test";

import { DITHER_CELLS, MOUNTAIN_CELLS, ditherLayout, mountainLayout } from "./basicNewAgentDither";

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

describe("mountainLayout", () => {
  it("covers the column at the export's own scale on a MacBook, centred", () => {
    const box = { width: 1184, height: 900 };
    const layout = mountainLayout(box, 2);
    expect(layout.cell).toBe(2.5);
    expect(layout.left).toBeLessThanOrEqual(0);
    expect(layout.top).toBeLessThanOrEqual(0);
    expect(layout.left + MOUNTAIN_CELLS.width * layout.cell).toBeGreaterThanOrEqual(box.width);
    expect(layout.top + MOUNTAIN_CELLS.height * layout.cell).toBeGreaterThanOrEqual(box.height);
  });

  it("covers both edges when the column is not a whole number of device pixels", () => {
    for (const [box, dpr] of [
      [{ width: 1107, height: 853 }, 1.25],
      [{ width: 692.39, height: 420 }, 3],
    ] as const) {
      const layout = mountainLayout(box, dpr);
      expect(layout.left + MOUNTAIN_CELLS.width * layout.cell).toBeGreaterThanOrEqual(box.width);
      expect(layout.top + MOUNTAIN_CELLS.height * layout.cell).toBeGreaterThanOrEqual(box.height);
    }
  });

  it("keeps cells and offsets whole in device pixels at fractional scales", () => {
    for (const dpr of [1, 1.25, 1.5, 2.2]) {
      const { cell, left, top } = mountainLayout({ width: 1000, height: 777 }, dpr);
      for (const value of [cell, left, top]) {
        expect(Number.isInteger(Math.round(value * dpr * 1e9) / 1e9), String(dpr)).toBe(true);
      }
    }
  });
});
