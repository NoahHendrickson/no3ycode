/**
 * The app icon's pixel leaf (assets/fork/app-icon.icon/Assets/mark.svg) on its 21-cell grid: the
 * one source for the launch overlay and its splash PNG (.fork/export-launch-leaf.ts).
 */
export const NO3Y_LEAF_GRID = 21;
const CENTRE = 10;
const OUTLINE = "#182E26";

// The top leaf, whole: "#" outline, "f" fill, "h" highlight. The others are it a quarter turn on.
const LEAF = [
  ".........###.........",
  "........#f#h#........",
  ".......#ff#fh#.......",
  "......#fff#ffh#......",
  "......#f#f#f#h#......",
  "......#ff###fh#......",
  "......#fff#fff#......",
  "......#f#f#f#f#......",
  "......#fff#fff#......",
  ".......#f###f#.......",
  ".......#######.......",
];

type Kind = "#" | "f" | "h";

interface LeafSpec {
  /** Clockwise quarter turns from the top leaf. */
  readonly quarter: 0 | 1 | 2 | 3;
  readonly fill: string;
  readonly highlight: string;
  /** Cells, on the mark's grid, where the logo differs from the turned leaf. */
  readonly patch?: ReadonlyArray<readonly [row: number, col: number, kind: Kind]>;
}

// Paint order: the one stacking that rests as the logo (top tucks under left, right under top).
const SPECS: ReadonlyArray<LeafSpec> = [
  { quarter: 2, fill: "#FCB01A", highlight: "#FFD233" },
  { quarter: 1, fill: "#F95B1C", highlight: "#FF8F0C" },
  { quarter: 0, fill: "#26B846", highlight: "#3AED62" },
  {
    quarter: 3,
    fill: "#008755",
    highlight: "#08B776",
    // The logo's centre junction, which the left leaf paints last.
    patch: [
      [9, 9, "f"],
      [9, 10, "f"],
      [11, 8, "#"],
      [11, 9, "f"],
      [11, 10, "f"],
    ],
  },
];

export interface No3yLeaf {
  readonly quarter: number;
  readonly cells: ReadonlyArray<{
    readonly row: number;
    readonly col: number;
    readonly color: string;
  }>;
  /** One path per colour, in grid units. */
  readonly layers: ReadonlyArray<{ readonly color: string; readonly d: string }>;
}

function buildLeaf(spec: LeafSpec): No3yLeaf {
  const kinds = new Map<number, Kind>();
  LEAF.forEach((line, r) =>
    [...line].forEach((kind, c) => {
      if (kind === ".") return;
      let [row, col] = [r, c];
      for (let turn = 0; turn < spec.quarter; turn++) [row, col] = [col, 2 * CENTRE - row];
      kinds.set(row * NO3Y_LEAF_GRID + col, kind as Kind);
    }),
  );
  for (const [row, col, kind] of spec.patch ?? []) kinds.set(row * NO3Y_LEAF_GRID + col, kind);
  const colorOf = { "#": OUTLINE, f: spec.fill, h: spec.highlight };
  const cells = [...kinds].map(([key, kind]) => ({
    row: Math.floor(key / NO3Y_LEAF_GRID),
    col: key % NO3Y_LEAF_GRID,
    color: colorOf[kind],
  }));
  const layers = (["#", "f", "h"] as const).map((kind) => {
    let d = "";
    for (let row = 0; row < NO3Y_LEAF_GRID; row++) {
      for (let col = 0; col < NO3Y_LEAF_GRID; col++) {
        if (kinds.get(row * NO3Y_LEAF_GRID + col) !== kind) continue;
        let end = col;
        while (kinds.get(row * NO3Y_LEAF_GRID + end + 1) === kind && end + 1 < NO3Y_LEAF_GRID)
          end++;
        d += `M${col} ${row}h${end - col + 1}v1h${col - end - 1}z`;
        col = end;
      }
    }
    return { color: colorOf[kind], d };
  });
  return { quarter: spec.quarter, cells, layers };
}

/** In paint order. */
export const NO3Y_LEAVES: ReadonlyArray<No3yLeaf> = SPECS.map(buildLeaf);
