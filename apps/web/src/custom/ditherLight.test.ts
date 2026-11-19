import { describe, expect, it } from "vite-plus/test";

import { DITHER_EMPTY, createDitherLight } from "./ditherLight";

const W = 864;
const H = 559;
const WHITE = 0;
const BLUE = 3;
const GREEN = 4;
const CYAN = 5;
const MINT = 6;

/** A blue drape (columns 300..499, every other cell) with a green streak down columns 390..409. */
function drape() {
  const cells = new Uint8Array(W * H).fill(DITHER_EMPTY);
  for (let y = 0; y < H; y++) {
    for (let x = 300; x < 500; x++) {
      if ((x + y) % 2 === 0) cells[y * W + x] = x >= 390 && x < 410 ? GREEN : BLUE;
    }
  }
  return cells;
}

describe("createDitherLight", () => {
  it("moves only the green streak and its edges, within their ramps", () => {
    const art = drape();
    const light = createDitherLight(art, W, H);
    const changed: { x: number; colour: number; was: number }[] = [];
    for (let s = 0; s < 9; s += 0.5)
      light.step(s, (i, colour) => changed.push({ x: i % W, colour, was: art[i]! }));
    expect(changed.some(({ colour }) => colour === GREEN)).toBe(true);
    expect(changed.some(({ colour }) => colour === BLUE)).toBe(true);
    for (const { x, colour, was } of changed) {
      // Empty cells never light, so nothing spills past the drape's edge.
      expect(was).not.toBe(DITHER_EMPTY);
      expect(x).toBeGreaterThanOrEqual(390 - 7);
      expect(x).toBeLessThan(410 + 7);
      // A lit cell goes back to its own colour in the art.
      expect([WHITE, BLUE, GREEN, CYAN, MINT, was]).toContain(colour);
    }
  });

  it("reports nothing when the light has not moved", () => {
    const light = createDitherLight(drape(), W, H);
    light.step(7, () => {});
    let changes = 0;
    light.step(7, () => changes++);
    expect(changes).toBe(0);
  });
});
