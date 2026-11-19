/**
 * The shimmer over Basic's new-agent dither — see `.fork/customizations.yaml#fork-basic-theme`.
 *
 * The picture's own green streaks breathe: each swells and thins in turn, the swell running slowly
 * down its length, and at its fullest its core brightens to mint and white with a cyan rim around
 * it. Everything is drawn the way the art is, by moving the green's local density and re-dithering
 * against the art's ordered thresholds, so the streaks keep their shape and trajectory and nothing
 * lights away from them.
 */

/** The PNG's colours by palette index; DITHER_EMPTY is its transparent ground. */
export const DITHER_PALETTE = [
  [0xff, 0xff, 0xff],
  [0xf0, 0x88, 0xf2],
  [0xf5, 0x7b, 0xf9],
  [0x3b, 0x78, 0xf1],
  [0x3e, 0xea, 0xc7],
  [0x74, 0xe2, 0xe4],
  [0x79, 0xea, 0xae],
] as const;
export const DITHER_EMPTY = DITHER_PALETTE.length;

/** The art's 8x8 ordered (Bayer) thresholds; ink sits on the high ones. */
const BAYER = (() => {
  let m = [
    [0, 2],
    [3, 1],
  ];
  for (let n = 2; n < 8; n *= 2) {
    const prev = m;
    m = Array.from({ length: n * 2 }, (_, y) =>
      Array.from(
        { length: n * 2 },
        (_, x) =>
          4 * prev[y % n]![x % n]! + [0, 2, 3, 1][2 * Math.floor(y / n) + Math.floor(x / n)]!,
      ),
    );
  }
  return m.map((row) => row.map((v) => (v + 0.5) / 64));
})();

const BLUE = 3;
const GREEN = 4;
const CYAN = 5;
const MINT = 6;

/** One breath, and the length of the swell travelling down a streak, in cells. */
const PERIOD_S = 9;
const WAVELENGTH = 220;
/** How far a breath moves the green's density, as a share of it. */
const SWELL = 0.8;
/** The most a breath adds to the green's density, and the densest it gets. */
const MAX_GAIN = 0.2;
const MAX_GREEN = 0.75;
/** How strongly a full streak's core and rim brighten. */
const CORE_LIGHT = 0.35;
const RIM_LIGHT = 0.25;
/** The neighbourhoods green density and the ink beneath it are read over. */
const GREEN_RADIUS = 6;
const INK_RADIUS = 4;

export interface DitherLight {
  /** Moves the shimmer to `seconds`, reporting each cell whose colour changes. */
  readonly step: (seconds: number, onChange: (cell: number, colour: number) => void) => void;
}

const isGreen = (v: number) => v === GREEN || v === MINT;

/** Neighbouring streaks breathe out of step, so the picture never pulses as one. */
const offsetAcross = (x: number) =>
  2 * Math.PI * (0.5 * Math.sin(x / 70) + 0.35 * Math.sin(x / 23 + 1.7));

/** `cells` holds a palette index per cell, row by row; DITHER_EMPTY for the ground. */
export function createDitherLight(cells: Uint8Array, width: number, height: number): DitherLight {
  // Summed-area tables: green, all ink, and each colour, for neighbourhood counts.
  const stride = width + 1;
  const GREEN_TABLE = DITHER_EMPTY + 1;
  const tables = Array.from(
    { length: DITHER_EMPTY + 2 },
    () => new Int32Array(stride * (height + 1)),
  );
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = cells[y * width + x]!;
      const o = (y + 1) * stride + x + 1;
      for (let k = 0; k < tables.length; k++) {
        const hit =
          k === GREEN_TABLE ? isGreen(v) : k === DITHER_EMPTY ? v !== DITHER_EMPTY : v === k;
        const t = tables[k]!;
        t[o] = (hit ? 1 : 0) + t[o - 1]! + t[o - stride]! - t[o - stride - 1]!;
      }
    }
  }
  const share = (k: number, x: number, y: number, r: number) => {
    const x0 = Math.max(0, x - r);
    const y0 = Math.max(0, y - r);
    const x1 = Math.min(width, x + r + 1);
    const y1 = Math.min(height, y + r + 1);
    const t = tables[k]!;
    const n =
      t[y1 * stride + x1]! - t[y0 * stride + x1]! - t[y1 * stride + x0]! + t[y0 * stride + x0]!;
    return n / ((x1 - x0) * (y1 - y0));
  };

  // The cells a breath can touch: inked, and near green. Empty cells never change, so the green
  // never spills past a drape's edge.
  const index: number[] = [];
  const green: number[] = [];
  const under: number[] = [];
  const phase: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const g = share(GREEN_TABLE, x, y, GREEN_RADIUS);
      if (g < 0.01 || cells[i] === DITHER_EMPTY) continue;
      // What shows when green leaves a cell: the commonest other ink around it, else the drape's blue.
      let best = 0;
      let beneath = BLUE;
      for (let k = 0; k < DITHER_EMPTY; k++) {
        if (isGreen(k)) continue;
        const n = share(k, x, y, INK_RADIUS);
        if (n > best) {
          best = n;
          beneath = k;
        }
      }
      index.push(i);
      green.push(g);
      under.push(beneath);
      phase.push((2 * Math.PI * y) / WAVELENGTH + offsetAcross(x));
    }
  }

  const shown = Uint8Array.from(cells);
  return {
    step(seconds, onChange) {
      const now = (2 * Math.PI * seconds) / PERIOD_S;
      for (let n = 0; n < index.length; n++) {
        const i = index[n]!;
        const x = i % width;
        const y = (i - x) / width;
        const art = cells[i]!;
        const g = green[n]!;
        const swell = Math.sin(now - phase[n]!);
        // Two orderings of the same thresholds: where green grows, and which green leaves first.
        const grow = BAYER[y & 7]![x & 7]!;
        const fade = BAYER[(y + 3) & 7]![(x + 5) & 7]!;
        let colour = art;
        if (isGreen(art)) {
          if (swell < 0 && fade < SWELL * -swell * 0.5) colour = under[n]!;
          else if (swell > 0 && fade > 1 - CORE_LIGHT * swell * Math.min(1, g / 0.5)) {
            colour = art === GREEN ? MINT : 0;
          }
        } else if (swell > 0) {
          // Capped, so a dense streak widens instead of filling in solid.
          const grown = Math.min(MAX_GREEN, g * (1 + SWELL * swell), g + MAX_GAIN * swell);
          if (grow > 1 - grown && grow <= 1 - g) colour = GREEN;
          else if (art === BLUE && g < 0.3) {
            const rim = 1 - Math.abs(g - 0.15) / 0.15;
            if (rim > 0 && fade > 1 - RIM_LIGHT * swell * rim) colour = CYAN;
          }
        }
        if (shown[i] !== colour) {
          shown[i] = colour;
          onChange(i, colour);
        }
      }
    },
  };
}
