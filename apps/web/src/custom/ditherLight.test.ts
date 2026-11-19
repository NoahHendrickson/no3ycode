import { describe, expect, it } from "vite-plus/test";

import {
  DITHER_EMPTY,
  DITHER_INK,
  DITHER_PALETTE,
  cellsFromRgba,
  createDitherLight,
} from "./ditherLight";

const W = 864;
const H = 559;
const { white, blue, green, cyan, mint } = DITHER_INK;

/** A blue drape (columns 300..499, every other cell) with a green streak down columns 390..409. */
function drape() {
  const cells = new Uint8Array(W * H).fill(DITHER_EMPTY);
  for (let y = 0; y < H; y++) {
    for (let x = 300; x < 500; x++) {
      if ((x + y) % 2 === 0) cells[y * W + x] = x >= 390 && x < 410 ? green : blue;
    }
  }
  return cells;
}

function rgbaOf(cells: Uint8Array) {
  const rgba = new Uint8ClampedArray(cells.length * 4);
  cells.forEach((v, i) => {
    const rgb = DITHER_PALETTE[v];
    if (rgb) rgba.set([...rgb, 255], i * 4);
  });
  return rgba;
}

describe("createDitherLight", () => {
  it("moves only inked cells near the green streak, within their ramps", () => {
    const art = drape();
    const rgba = rgbaOf(art);
    const light = createDitherLight(art, W, H);
    const changed = new Set<number>();
    for (let s = 0; s < 9; s += 0.5) {
      light.step(s, rgba);
      cellsFromRgba(rgba).forEach((v, i) => {
        if (v !== art[i]) changed.add(i);
      });
    }
    const shown = cellsFromRgba(rgba);
    expect(changed.size).toBeGreaterThan(0);
    for (const i of changed) {
      const x = i % W;
      expect(x).toBeGreaterThanOrEqual(390 - 7);
      expect(x).toBeLessThan(410 + 7);
      // Empty cells never light, so nothing spills past the drape's edge.
      expect(art[i]).not.toBe(DITHER_EMPTY);
      expect([white, blue, green, cyan, mint]).toContain(shown[i]);
    }
  });

  it("reports nothing when the light has not moved", () => {
    const art = drape();
    const rgba = rgbaOf(art);
    const light = createDitherLight(art, W, H);
    light.step(7, rgba);
    expect(light.step(7, rgba)).toBeNull();
  });
});

describe("cellsFromRgba", () => {
  it("reads every ink and the transparent ground back to its palette index", () => {
    const art = drape();
    expect(cellsFromRgba(rgbaOf(art))).toEqual(art);
  });
});
