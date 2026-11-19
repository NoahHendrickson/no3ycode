/**
 * The dither's green streaks breathe — see `.fork/customizations.yaml#fork-basic-theme`. Their local
 * density swells and thins and is re-dithered against the art's own ordered thresholds, so the
 * streaks keep their shape and only inked cells near green ever change.
 */

/** The PNG's inks by name; each value is its palette index. */
export const DITHER_INK = {
  white: 0,
  pink: 1,
  magenta: 2,
  blue: 3,
  green: 4,
  cyan: 5,
  mint: 6,
} as const;

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

const { white, pink, magenta, blue, green, cyan, mint } = DITHER_INK;
const isGreen = (v: number) => v === green || v === mint;
/** The inks green can give way to, read around each cell. */
const BENEATH = [white, pink, magenta, blue, cyan] as const;

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

/** Neighbouring streaks breathe out of step, so the picture never pulses as one. */
const offsetAcross = (x: number) =>
  2 * Math.PI * (0.5 * Math.sin(x / 70) + 0.35 * Math.sin(x / 23 + 1.7));

/** Palette indices for a decoded RGBA image of the PNG, one per pixel. */
export function cellsFromRgba(rgba: Uint8ClampedArray): Uint8Array {
  const cells = new Uint8Array(rgba.length / 4);
  for (let i = 0; i < cells.length; i++) {
    const o = i * 4;
    const match = DITHER_PALETTE.findIndex(
      ([r, g, b]) => rgba[o] === r && rgba[o + 1] === g && rgba[o + 2] === b,
    );
    cells[i] = rgba[o + 3] === 0 || match < 0 ? DITHER_EMPTY : match;
  }
  return cells;
}

/** Everything a breath reads about the cells it can touch, fixed once at setup. */
function analyseDrapes(cells: Uint8Array, width: number, height: number) {
  // Summed-area tables of each ink green gives way to, then of green, for neighbourhood shares.
  // They are local, so they are freed once setup returns.
  const stride = width + 1;
  const GREEN_TABLE = BENEATH.length;
  const tables = Array.from(
    { length: GREEN_TABLE + 1 },
    () => new Int32Array(stride * (height + 1)),
  );
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = cells[y * width + x]!;
      const o = (y + 1) * stride + x + 1;
      for (let k = 0; k <= GREEN_TABLE; k++) {
        const t = tables[k]!;
        const hit = k === GREEN_TABLE ? isGreen(v) : v === BENEATH[k];
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
  const found: number[] = [];
  const greenShare: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (cells[i] === DITHER_EMPTY) continue;
      const g = share(GREEN_TABLE, x, y, GREEN_RADIUS);
      if (g < 0.01) continue;
      found.push(i);
      greenShare.push(g);
    }
  }

  const n = found.length;
  const drapes = {
    index: Int32Array.from(found),
    x: new Uint16Array(n),
    y: new Uint16Array(n),
    green: Float32Array.from(greenShare),
    /** What shows when green leaves a cell: the commonest other ink around it, else blue. */
    beneath: new Uint8Array(n),
    phase: new Float32Array(n),
    /** Two orderings of the same thresholds: where green grows, and which green leaves first. */
    grow: new Float32Array(n),
    fade: new Float32Array(n),
    core: new Float32Array(n),
    rim: new Float32Array(n),
  };
  for (let c = 0; c < n; c++) {
    const i = found[c]!;
    const x = i % width;
    const y = (i - x) / width;
    const g = greenShare[c]!;
    let best = 0;
    let beneath: number = blue;
    for (let k = 0; k < BENEATH.length; k++) {
      const count = share(k, x, y, INK_RADIUS);
      if (count > best) {
        best = count;
        beneath = BENEATH[k]!;
      }
    }
    drapes.x[c] = x;
    drapes.y[c] = y;
    drapes.beneath[c] = beneath;
    drapes.phase[c] = (2 * Math.PI * y) / WAVELENGTH + offsetAcross(x);
    drapes.grow[c] = BAYER[y & 7]![x & 7]!;
    drapes.fade[c] = BAYER[(y + 3) & 7]![(x + 5) & 7]!;
    drapes.core[c] = Math.min(1, g / 0.5);
    drapes.rim[c] = cells[i] === blue && g < 0.3 ? 1 - Math.abs(g - 0.15) / 0.15 : 0;
  }
  return drapes;
}

export interface DirtyRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface DitherLight {
  /** Moves the breath to `seconds`, writing changed cells into `rgba`; null when none changed. */
  readonly step: (seconds: number, rgba: Uint8ClampedArray) => DirtyRect | null;
}

/** `cells` holds a palette index per cell, row by row; DITHER_EMPTY for the ground. */
export function createDitherLight(cells: Uint8Array, width: number, height: number): DitherLight {
  const drapes = analyseDrapes(cells, width, height);
  const shown = Uint8Array.from(cells);
  return {
    step(seconds, rgba) {
      const now = (2 * Math.PI * seconds) / PERIOD_S;
      let x0: number = width;
      let y0: number = height;
      let x1 = -1;
      let y1 = -1;
      for (let c = 0; c < drapes.index.length; c++) {
        const i = drapes.index[c]!;
        const art = cells[i]!;
        const g = drapes.green[c]!;
        const fade = drapes.fade[c]!;
        const swell = Math.sin(now - drapes.phase[c]!);
        let colour = art;
        if (isGreen(art)) {
          if (swell < 0 && fade < SWELL * -swell * 0.5) colour = drapes.beneath[c]!;
          else if (swell > 0 && fade > 1 - CORE_LIGHT * swell * drapes.core[c]!) {
            colour = art === green ? mint : white;
          }
        } else if (swell > 0) {
          // Capped, so a dense streak widens instead of filling in solid.
          const grown = Math.min(MAX_GREEN, g * (1 + SWELL * swell), g + MAX_GAIN * swell);
          const grow = drapes.grow[c]!;
          if (grow > 1 - grown && grow <= 1 - g) colour = green;
          else if (fade > 1 - RIM_LIGHT * swell * drapes.rim[c]!) colour = cyan;
        }
        if (shown[i] === colour) continue;
        shown[i] = colour;
        // Candidates are inked, and every colour they take is an ink, so each is opaque.
        const rgb = DITHER_PALETTE[colour]!;
        const o = i * 4;
        rgba[o] = rgb[0];
        rgba[o + 1] = rgb[1];
        rgba[o + 2] = rgb[2];
        rgba[o + 3] = 255;
        const x = drapes.x[c]!;
        const y = drapes.y[c]!;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      return x1 < 0 ? null : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
    },
  };
}
