/**
 * The portfolio texture's glyphs (no3y's portfolio, `src/pixelTexture.ts`): every glyph
 * is rects on a 16-unit grid, so a face, a leaf and a mark can share one cell.
 */
type Rect = readonly [x: number, y: number, w: number, h: number];
export type Glyph = readonly Rect[];

export const GLYPH_SIZE = 16;

/** Pixel art rows (`on` filled), 1 unit a square, centred in the 16. */
function fromRows(rows: readonly string[], on: string): Glyph {
  const width = Math.max(...rows.map((row) => row.length));
  const ox = Math.floor((GLYPH_SIZE - width) / 2);
  const oy = Math.floor((GLYPH_SIZE - rows.length) / 2);
  return rows.flatMap((row, y) =>
    [...row].flatMap((ch, x): Rect[] => (ch === on ? [[ox + x, oy + y, 1, 1]] : [])),
  );
}

const FACE_DOTS: readonly (readonly [number, number])[][] = [
  [
    [5, 2],
    [9, 2],
    [5, 4],
    [9, 4],
    [11, 8],
    [5, 10],
    [7, 10],
    [9, 10],
  ],
  [
    [5, 4],
    [9, 4],
    [3, 8],
    [11, 8],
    [3, 10],
    [5, 10],
    [7, 10],
    [9, 10],
    [11, 10],
  ],
  [
    [5, 2],
    [9, 2],
    [3, 6],
    [5, 6],
    [7, 6],
    [9, 6],
    [11, 6],
    [3, 8],
    [11, 8],
    [5, 10],
    [7, 10],
    [9, 10],
  ],
  [
    [5, 4],
    [9, 4],
    [12, 8],
    [10, 10],
    [8, 10],
    [6, 10],
    [4, 10],
    [2, 8],
  ],
  [
    [3, 3],
    [5, 5],
    [9, 3],
    [11, 5],
    [3, 10],
    [5, 10],
    [7, 10],
    [9, 10],
    [11, 10],
  ],
];

/** The heart's two shine squares (`+`) stay holes: the cell's ground shows through them. */
const HEART_ROWS = [
  ".###.###.",
  "##+######",
  "#+#######",
  ".#######.",
  "..#####..",
  "...###...",
  "....#....",
];

const FACE_GLYPHS: Glyph[] = [
  ...FACE_DOTS.map((dots): Glyph => dots.map(([x, y]): Rect => [x, y, 2, 2])),
  fromRows(HEART_ROWS, "#"),
];

/** The mark's four leaves, clockwise from the top; a glyph is a leaf's `k` outline and veins. */
const LEAF_ROWS = [
  [
    "....k....",
    "...kkk...",
    "..kgkGk..",
    ".kggkgGk.",
    "kgggkggGk",
    "kgkgkgkGk",
    "kggkkkgGk",
    "kgggkgggk",
    "kgkgkgkgk",
    "kggkkgggk",
    ".kggkggk.",
    "..kgkgk..",
    "...kkk...",
  ],
  [
    "...kkkkkk....",
    "..kooooook...",
    ".kookookook..",
    "kookookooook.",
    "kkkkkkkkkkkkk",
    "koooookoooOk.",
    ".kookookoOk..",
    "..koooOOOk...",
    "...kkkkkk....",
  ],
  [
    "...kkk...",
    "..kykyk..",
    ".kyykyyk.",
    "kyyykkyyk",
    "kykykykyk",
    "kyyykyyyk",
    "kYykkkyyk",
    "kYkykykyk",
    "kYyykyyyk",
    ".kYykyyk.",
    "..kYkyk..",
    "...kkk...",
    "....k....",
  ],
  [
    "....kkkkkk...",
    "...kTTTtttk..",
    "..kTtkttkttk.",
    ".kTtttktttttk",
    "kkkkkkkkkkkkk",
    ".kttttkttkttk",
    "..kttkttkttk.",
    "...kttttttk..",
    "....kkkkkk...",
  ],
];

const LEAF_GLYPHS: Glyph[] = LEAF_ROWS.map((rows) => fromRows(rows, "k"));

/** Fills each row between its outermost squares, turning an outline into its solid. */
const solid = (rows: readonly string[]) =>
  rows.map((row) => {
    const a = row.indexOf("#");
    const b = row.lastIndexOf("#");
    return a < 0 ? row : ".".repeat(a) + "#".repeat(b - a + 1) + ".".repeat(row.length - b - 1);
  });
const flipY = (rows: readonly string[]) => [...rows].reverse();
const flipX = (rows: readonly string[]) => rows.map((row) => [...row].reverse().join(""));

const CARET = ["....#....", "...#.#...", "..#...#..", ".#.....#.", "#.......#"];
const CIRCLE = [
  "..#####..",
  ".#.....#.",
  "#.......#",
  "#.......#",
  "#.......#",
  "#.......#",
  "#.......#",
  ".#.....#.",
  "..#####..",
];
const DIAMOND = [
  "....#....",
  "...#.#...",
  "..#...#..",
  ".#.....#.",
  "#.......#",
  ".#.....#.",
  "..#...#..",
  "...#.#...",
  "....#....",
];
const SQUARE = [
  "#########",
  "#.......#",
  "#.......#",
  "#.......#",
  "#.......#",
  "#.......#",
  "#.......#",
  "#.......#",
  "#########",
];
const ARROW_UP = [
  "....#....",
  "...###...",
  "..#####..",
  ".#######.",
  "#########",
  "...###...",
  "...###...",
  "...###...",
  "...###...",
];
const ARROW_RIGHT = [
  "....#....",
  ".....#...",
  "......#..",
  ".......#.",
  "#########",
  ".......#.",
  "......#..",
  ".....#...",
  "....#....",
];

const SHAPE_ROWS: readonly (readonly string[])[] = [
  [
    "#.......#",
    ".#.....#.",
    "..#...#..",
    "...#.#...",
    "....#....",
    "...#.#...",
    "..#...#..",
    ".#.....#.",
    "#.......#",
  ],
  [
    "##......##",
    "###....###",
    ".###..###.",
    "..######..",
    "...####...",
    "...####...",
    "..######..",
    ".###..###.",
    "###....###",
    "##......##",
  ],
  [
    "........#",
    ".......#.",
    "......#..",
    ".....#...",
    "....#....",
    "...#.....",
    "..#......",
    ".#.......",
    "#........",
  ],
  [
    ".......##",
    "......###",
    ".....###.",
    "....###..",
    "...###...",
    "..###....",
    ".###.....",
    "###......",
    "##.......",
  ],
  CARET,
  ["....#....", "...###...", "..##.##..", ".##...##.", "##.....##"],
  ARROW_UP,
  flipY(ARROW_UP),
  ARROW_RIGHT,
  flipX(ARROW_RIGHT),
  SQUARE,
  solid(SQUARE.slice(1, -1).map((row) => row.slice(1, -1))),
  CIRCLE,
  solid(CIRCLE),
  DIAMOND,
  solid(DIAMOND),
  [
    "....#....",
    "....#....",
    "....#....",
    "....#....",
    "#########",
    "....#....",
    "....#....",
    "....#....",
    "....#....",
  ],
  ["...##...", "...##...", "...##...", "########", "########", "...##...", "...##...", "...##..."],
  solid(CARET),
  [
    ".....###.....",
    "....#####....",
    ".##.#####.##.",
    "#############",
    "######.######",
    "#####...#####",
    ".####...####.",
    "..####.####..",
    ".###########.",
    ".###########.",
    "..####.####..",
    "..###...###..",
  ],
  [
    "#########",
    "#.......#",
    "#.......#",
    "#..###..#",
    "#..###..#",
    "#..###..#",
    "#.......#",
    "#.......#",
    "#########",
  ],
];

const SHAPE_GLYPHS: Glyph[] = SHAPE_ROWS.map((rows) => fromRows(rows, "#"));

/** Each group takes an equal share of the cells, so the 21 marks don't swamp the 6 faces. */
export const GLYPH_GROUPS: readonly Glyph[][] = [FACE_GLYPHS, LEAF_GLYPHS, SHAPE_GLYPHS];

/** The portfolio's Landing swatches by slot, `family * 2 + highlight`; the top leaf's highlight is its blue. */
export const SLOT_COLORS = [
  "#26b846",
  "#44aaf8",
  "#f95b1c",
  "#ff8f0c",
  "#fcb01a",
  "#ffd233",
  "#008755",
  "#08b776",
] as const;
