import { describe, expect, it } from "vite-plus/test";

import { createTextureModel, type TextureCell } from "./textureModel";

/** mulberry32, so a deal repeats. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const look = ({ kind, slot, glyph, near, dash }: TextureCell) => ({
  kind,
  slot,
  glyph,
  near,
  dash,
});

describe("createTextureModel", () => {
  it("deals the same texture from the same seed, the shape in from the right", () => {
    const a = createTextureModel(40, 30, seeded(7));
    const b = createTextureModel(40, 30, seeded(7));
    expect(a.cells).toHaveLength(40 * 30);
    expect(a.cells.map(look)).toEqual(b.cells.map(look));
    expect(createTextureModel(40, 30, seeded(8)).cells.map(look)).not.toEqual(a.cells.map(look));

    const column = (x: number) => a.cells.filter((c) => c.x === x);
    expect(column(0).every((c) => c.kind === "field")).toBe(true);
    expect(a.cells[39]!.kind).not.toBe("field");
  });

  it("returns every cell a step changes, so a frame redraws only those", () => {
    const model = createTextureModel(40, 30, seeded(3));
    let before = model.cells.map(look);
    let changes = 0;
    for (let now = 20; now <= 3000; now += 20) {
      const dirty = model.step(now, 0.02);
      model.cells.forEach((c, i) => {
        if (JSON.stringify(look(c)) === JSON.stringify(before[i])) return;
        changes++;
        expect(dirty.has(c)).toBe(true);
      });
      before = model.cells.map(look);
    }
    expect(changes).toBeGreaterThan(0);
  });
});
