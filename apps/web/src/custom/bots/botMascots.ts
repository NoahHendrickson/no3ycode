/**
 * Bot mascots — see `.fork/customizations.yaml#fork-bots`. The leaf and petal bots from the Noey
 * Brand file's "bots" page, drawn by the same rules as its generator: a silhouette mask per shape,
 * then outline, highlight, veins and eyes. Each cell is one pixel of the sprite.
 */
import { BOT_THREAD_TAG_PREFIX_MASCOT, type BotThreadFields } from "./botThreads";

export const BOT_MASCOT_MOODS = ["Idle", "Thinking", "Happy", "Sleeping", "Error"] as const;
export type BotMascotMood = (typeof BOT_MASCOT_MOODS)[number];

type EyeSize = "s" | "l";

interface MascotShape {
  readonly kind: "leaf" | "petal";
  /** Base, highlight, then for petals the vein shade and the blush. */
  readonly colors: readonly [string, string, string?, string?];
  readonly eyes: EyeSize;
  /** Face centre and the cells between the eyes' centres. */
  readonly face: { readonly cx: number; readonly cy: number; readonly gap: number };
  readonly veins?: "fan" | "none";
  /** `#` body, `s` stem, `%` sepal, `.` empty. */
  readonly rows: ReadonlyArray<string>;
}

const INK = "#000000";
const SHINE = "#f5efe0";
const SEPAL = ["#26b846", "#3aed62"] as const;

const LEAF = {
  green: ["#26b846", "#3aed62"],
  orange: ["#f95b1c", "#ff8f0c"],
  yellow: ["#fcb01a", "#ffd233"],
  teal: ["#008755", "#08b776"],
} as const;

const PETAL = {
  pink: ["#ff4f95", "#ff8ab8", "#d8357a", "#ffc2d9"],
  sky: ["#3cb5fc", "#86d3ff", "#1d8bd1", "#ffb3cf"],
  orange: ["#f95b1c", "#ff8f0c", "#c9420f", "#ffc09a"],
  peri: ["#7970f9", "#a9a3ff", "#5149d6", "#ffb3cf"],
  purple: ["#c841fa", "#df8bff", "#9a25cc", "#ffb3cf"],
  yellow: ["#fcb01a", "#ffd233", "#d58b07", "#ff9a7a"],
} as const;

const SHAPES = {
  Classic: {
    kind: "leaf",
    colors: LEAF.green,
    eyes: "s",
    face: { cx: 4, cy: 6, gap: 3 },
    rows: [
      "....#....",
      "...###...",
      "..#####..",
      ".#######.",
      "#########",
      "#########",
      "#########",
      "#########",
      "#########",
      ".#######.",
      "..#####..",
      "...###...",
      "....s....",
    ],
  },
  Round: {
    kind: "leaf",
    colors: LEAF.orange,
    eyes: "l",
    face: { cx: 6, cy: 7, gap: 4 },
    rows: [
      "......#......",
      ".....###.....",
      "...#######...",
      "..#########..",
      ".###########.",
      ".###########.",
      "#############",
      "#############",
      "#############",
      ".###########.",
      ".###########.",
      "..#########..",
      "...#######...",
      ".....###.....",
      "......s......",
      "......s......",
    ],
  },
  Willow: {
    kind: "leaf",
    colors: LEAF.teal,
    eyes: "s",
    face: { cx: 4, cy: 9, gap: 3 },
    rows: [
      "....#....",
      "....#....",
      "...###...",
      "...###...",
      "..#####..",
      "..#####..",
      ".#######.",
      ".#######.",
      "#########",
      "#########",
      "#########",
      "#########",
      ".#######.",
      ".#######.",
      "..#####..",
      "..#####..",
      "...###...",
      "....#....",
      "....s....",
      "....s....",
    ],
  },
  Heart: {
    kind: "leaf",
    colors: LEAF.yellow,
    eyes: "l",
    face: { cx: 7, cy: 8, gap: 4 },
    rows: [
      ".......#.......",
      "......###......",
      ".....#####.....",
      "....#######....",
      "...#########...",
      "..###########..",
      ".#############.",
      ".#############.",
      "###############",
      "###############",
      "###############",
      ".######.######.",
      "..####...####..",
      ".......s.......",
      ".......s.......",
    ],
  },
  Maple: {
    kind: "leaf",
    colors: LEAF.orange,
    eyes: "l",
    face: { cx: 10, cy: 9, gap: 4 },
    rows: [
      "..........#..........",
      ".........###.........",
      "........#####........",
      "........#####........",
      "...#....#####....#...",
      "...##..#######..##...",
      "...###.#######.###...",
      "...###############...",
      "#...#############...#",
      "##..#############..##",
      ".###################.",
      "..#################..",
      "...###############...",
      "....#############....",
      "......#########......",
      ".....####...####.....",
      "..........s..........",
      "..........s..........",
    ],
  },
  Oak: {
    kind: "leaf",
    colors: LEAF.teal,
    eyes: "l",
    face: { cx: 6, cy: 8, gap: 4 },
    rows: [
      ".....###.....",
      "....#####....",
      "...#######...",
      "..#########..",
      ".###########.",
      ".###########.",
      "..#########..",
      ".###########.",
      "#############",
      "#############",
      ".###########.",
      "#############",
      "#############",
      ".###########.",
      "..#########..",
      "...#######...",
      "....#####....",
      "......s......",
      "......s......",
    ],
  },
  Ginkgo: {
    kind: "leaf",
    colors: LEAF.yellow,
    eyes: "l",
    face: { cx: 8, cy: 5, gap: 4 },
    rows: [
      ".######...######.",
      "########.########",
      "#################",
      "#################",
      ".###############.",
      "..#############..",
      "...###########...",
      "....#########....",
      ".....#######.....",
      "......#####......",
      ".......###.......",
      "........s........",
      "........s........",
      "........s........",
    ],
  },
  Monstera: {
    kind: "leaf",
    colors: LEAF.green,
    eyes: "l",
    face: { cx: 8, cy: 6, gap: 4 },
    rows: [
      ".....#######.....",
      "...###########...",
      "..#############..",
      ".###############.",
      ".###############.",
      "#################",
      "#################",
      "#################",
      "#################",
      "...##############",
      "#################",
      ".###.###########.",
      ".##############..",
      "..#############..",
      "...###########...",
      ".....###.###.....",
      "........s........",
      "........s........",
    ],
  },
  Sakura: {
    kind: "petal",
    colors: PETAL.pink,
    eyes: "l",
    face: { cx: 6, cy: 6, gap: 4 },
    veins: "fan",
    rows: [
      "..###...###..",
      ".#####.#####.",
      "#############",
      "#############",
      "#############",
      "#############",
      "#############",
      ".###########.",
      ".###########.",
      "..#########..",
      "...#######...",
      "....#####....",
      ".....###.....",
      "......s......",
      "......s......",
    ],
  },
  Spoon: {
    kind: "petal",
    colors: PETAL.sky,
    eyes: "s",
    face: { cx: 4, cy: 5, gap: 3 },
    veins: "fan",
    rows: [
      "...###...",
      ".#######.",
      ".#######.",
      "#########",
      "#########",
      "#########",
      "#########",
      "#########",
      ".#######.",
      ".#######.",
      "..#####..",
      "..#####..",
      "...###...",
      "...###...",
      "....#....",
      "....s....",
      "....s....",
    ],
  },
  Tulip: {
    kind: "petal",
    colors: PETAL.orange,
    eyes: "l",
    face: { cx: 7, cy: 7, gap: 4 },
    veins: "fan",
    rows: [
      "#......#......#",
      "##....###....##",
      "###..#####..###",
      "####.#####.####",
      "###############",
      "###############",
      "###############",
      "###############",
      "###############",
      ".#############.",
      ".#############.",
      "..###########..",
      "...#########...",
      ".....#####.....",
      ".......s.......",
      ".......s.......",
    ],
  },
  Drop: {
    kind: "petal",
    colors: PETAL.peri,
    eyes: "l",
    face: { cx: 6, cy: 6, gap: 4 },
    veins: "fan",
    rows: [
      "....#####....",
      "..#########..",
      ".###########.",
      ".###########.",
      "#############",
      "#############",
      "#############",
      "#############",
      ".###########.",
      ".###########.",
      "..#########..",
      "...#######...",
      "....#####....",
      ".....###.....",
      "......#......",
      "......s......",
    ],
  },
  Bell: {
    kind: "petal",
    colors: PETAL.purple,
    eyes: "l",
    face: { cx: 7, cy: 8, gap: 4 },
    veins: "none",
    rows: [
      ".......s.......",
      ".......s.......",
      ".....#####.....",
      "....#######....",
      "...#########...",
      "...#########...",
      "..###########..",
      "..###########..",
      "..###########..",
      ".#############.",
      ".#############.",
      "###############",
      "###############",
      "##..##...##..##",
    ],
  },
  Bud: {
    kind: "petal",
    colors: PETAL.yellow,
    eyes: "l",
    face: { cx: 6, cy: 6, gap: 4 },
    veins: "none",
    rows: [
      "......#......",
      ".....###.....",
      "....#####....",
      "...#######...",
      "..#########..",
      ".###########.",
      ".###########.",
      "#############",
      "#############",
      "#############",
      "%%#########%%",
      "%%%%#####%%%%",
      ".%%%%%%%%%%%.",
      "..%%%%%%%%%..",
      "....%%%%%....",
      "......s......",
      "......s......",
    ],
  },
} as const satisfies Record<string, MascotShape>;

export type BotMascotShape = keyof typeof SHAPES;
export const BOT_MASCOT_SHAPES = Object.keys(SHAPES) as ReadonlyArray<BotMascotShape>;

/** Eye sprites: `k` ink, `W` catchlight, `.` leaves the cell. */
const EYES: Record<EyeSize, Record<BotMascotMood, ReadonlyArray<string>>> = {
  s: {
    Idle: ["Wk", "kk", "kk"],
    Thinking: ["kW", "kk", ".."],
    Happy: ["kk", "k."],
    Sleeping: ["..", "..", "kk"],
    Error: ["k.", ".k", "k."],
  },
  l: {
    Idle: ["Wk", "kk", "kk"],
    Thinking: [".kW", ".kk", "..."],
    Happy: [".k.", "k.k"],
    Sleeping: ["...", "...", "kkk"],
    Error: ["k.k", ".k.", "k.k"],
  },
};

type Grid = Array<Array<string>>;

const cellAt = (grid: Grid, x: number, y: number): string => grid[y]?.[x] ?? "";
const setCell = (grid: Grid, x: number, y: number, value: string) => {
  const row = grid[y];
  if (row !== undefined && x >= 0 && x < row.length) row[x] = value;
};
const mirrored = (rows: ReadonlyArray<string>) => rows.map((row) => [...row].reverse().join(""));

function placeEyes(grid: Grid, shape: MascotShape, mood: BotMascotMood) {
  const sprite = EYES[shape.eyes][mood];
  const { cx, cy, gap } = shape.face;
  const left = cx - Math.floor(gap / 2);
  const put = (rows: ReadonlyArray<string>, eyeX: number) => {
    const x0 = eyeX - Math.floor((rows[0]?.length ?? 0) / 2);
    rows.forEach((row, dy) =>
      [...row].forEach((cell, dx) => {
        if (cell !== ".") setCell(grid, x0 + dx, cy - 1 + dy, cell === "W" ? "w" : "k");
      }),
    );
  };
  put(sprite, left);
  // Narrow faces mirror the slanted eyes so they lean toward each other.
  put(
    (mood === "Happy" || mood === "Error") && shape.eyes === "s" ? mirrored(sprite) : sprite,
    left + gap,
  );
}

function buildLeaf(shape: MascotShape, mood: BotMascotMood): Grid {
  const height = shape.rows.length;
  const body = (x: number, y: number) => shape.rows[y]?.[x] === "#";
  const grid: Grid = shape.rows.map((row) => [...row].map((cell) => (cell === "s" ? "k" : ".")));
  shape.rows.forEach((row, y) =>
    [...row].forEach((_, x) => {
      if (!body(x, y)) return;
      const edge = !body(x - 1, y) || !body(x + 1, y) || !body(x, y - 1) || !body(x, y + 1);
      setCell(grid, x, y, edge ? "k" : "b");
    }),
  );
  const { cx, cy } = shape.face;
  // Highlight: interior cells against the outline on the upper right.
  grid.forEach((row, y) =>
    row.forEach((cell, x) => {
      if (cell !== "b" || x <= cx || y > cy + 1) return;
      if (cellAt(grid, x + 1, y) === "k" || cellAt(grid, x, y - 1) === "k")
        setCell(grid, x, y, "h");
    }),
  );
  // Midrib from the stem up to below the face, with chevrons pointing at the tip.
  const fill = (x: number, y: number) => "bh".includes(cellAt(grid, x, y) || "-");
  const faceBottom = cy + 3;
  let base = height - 1;
  while (base > 0 && !fill(cx, base)) base--;
  for (let y = base; y > faceBottom; y--) if (fill(cx, y)) setCell(grid, cx, y, "k");
  const veins: Array<readonly [number, number]> = [];
  for (let y = base - 1; y > faceBottom + 2; y -= 3) {
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [-2, -1],
      [2, -1],
    ] as const) {
      const x = cx + dx;
      if (fill(x, y + dy) && cellAt(grid, x + Math.sign(dx), y + dy) !== "k") {
        setCell(grid, x, y + dy, "v");
        veins.push([x, y + dy]);
      }
    }
  }
  placeEyes(grid, shape, mood);
  for (const [x, y] of veins) if (cellAt(grid, x, y) === "v") setCell(grid, x, y, "k");
  return grid;
}

function buildPetal(shape: MascotShape, mood: BotMascotMood): Grid {
  const height = shape.rows.length;
  const at = (x: number, y: number) => shape.rows[y]?.[x] ?? ".";
  const isBody = (cell: string) => cell !== "." && cell !== "s";
  const grid: Grid = shape.rows.map((row) => [...row].map((cell) => (cell === "s" ? "k" : ".")));
  const region = new Map<string, string>();
  shape.rows.forEach((row, y) =>
    [...row].forEach((cell, x) => {
      if (!isBody(cell)) return;
      // The body is outlined where it meets nothing; the sepal also where it meets the body.
      const edge = (
        [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ] as const
      ).some(([dx, dy]) => {
        const neighbour = at(x + dx, y + dy);
        return !isBody(neighbour) || (cell === "%" && neighbour === "#");
      });
      setCell(grid, x, y, edge ? "k" : cell === "%" ? "g" : "b");
      region.set(`${x},${y}`, cell);
    }),
  );
  const { cx, cy, gap } = shape.face;
  // Highlight: each region's upper-right cells against an outline.
  const centre = new Map<string, { x: number; y: number; count: number }>();
  for (const [key, cell] of region) {
    const [x = 0, y = 0] = key.split(",").map(Number);
    const sum = centre.get(cell) ?? { x: 0, y: 0, count: 0 };
    centre.set(cell, { x: sum.x + x, y: sum.y + y, count: sum.count + 1 });
  }
  const lit: Record<string, string> = { b: "h", g: "G" };
  grid.forEach((row, y) =>
    row.forEach((cell, x) => {
      const lifted = lit[cell];
      const kind = region.get(`${x},${y}`);
      const sum = kind === undefined ? undefined : centre.get(kind);
      if (lifted === undefined || sum === undefined) return;
      const originX = kind === "#" ? cx : sum.x / sum.count;
      const originY = kind === "#" ? cy + 1 : sum.y / sum.count;
      const againstOutline = cellAt(grid, x + 1, y) === "k" || cellAt(grid, x, y - 1) === "k";
      if (againstOutline && x > originX && y <= originY) setCell(grid, x, y, lifted);
    }),
  );
  const fill = (x: number, y: number) => "bh".includes(cellAt(grid, x, y) || "-");
  if (shape.veins === "fan") {
    const faceBottom = cy + 3;
    let base = height - 1;
    while (base > 0 && !"bhgG".includes(cellAt(grid, cx, base) || "-")) base--;
    for (const direction of [-1, 0, 1]) {
      for (let step = direction === 0 ? 0 : 1; step < base - faceBottom; step++) {
        const x = cx + Math.round((direction * step) / 2.2);
        if (fill(x, base - step)) setCell(grid, x, base - step, "d");
      }
    }
  }
  // Blush under the outer corners of the eyes.
  const left = cx - Math.floor(gap / 2);
  for (const blushX of [left - 2, left - 1, left + gap + 1, left + gap + 2]) {
    if (fill(blushX, cy + 2)) setCell(grid, blushX, cy + 2, "p");
  }
  placeEyes(grid, shape, mood);
  return grid;
}

export interface BotMascotSprite {
  readonly width: number;
  readonly height: number;
  /** One path per colour, each cell a 1×1 square. */
  readonly paths: ReadonlyArray<{ readonly fill: string; readonly d: string }>;
}

/** The sprite's cells as rows of colour keys; exported for the guard that pins the drawing. */
export function botMascotRows(shape: BotMascotShape, mood: BotMascotMood): ReadonlyArray<string> {
  const definition: MascotShape = SHAPES[shape];
  const grid =
    definition.kind === "leaf" ? buildLeaf(definition, mood) : buildPetal(definition, mood);
  return grid.map((row) => row.join(""));
}

const sprites = new Map<string, BotMascotSprite>();

export function botMascotSprite(shape: BotMascotShape, mood: BotMascotMood): BotMascotSprite {
  const key = `${shape}:${mood}`;
  const cached = sprites.get(key);
  if (cached !== undefined) return cached;
  const definition: MascotShape = SHAPES[shape];
  const [base, highlight, vein, blush] = definition.colors;
  const fills: Record<string, string> = {
    k: INK,
    w: SHINE,
    b: base,
    h: highlight,
    d: vein ?? base,
    p: blush ?? base,
    g: SEPAL[0],
    G: SEPAL[1],
  };
  const rows = botMascotRows(shape, mood);
  const runs = new Map<string, Array<string>>();
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const cell = row[x] ?? ".";
      let end = x + 1;
      while (row[end] === cell) end++;
      const fill = fills[cell];
      if (fill !== undefined) {
        runs.set(fill, [...(runs.get(fill) ?? []), `M${x} ${y}h${end - x}v1h${x - end}z`]);
      }
      x = end;
    }
  });
  const sprite = {
    width: rows[0]?.length ?? 0,
    height: rows.length,
    paths: [...runs].map(([fill, segments]) => ({ fill, d: segments.join("") })),
  };
  sprites.set(key, sprite);
  return sprite;
}

const isShape = (value: string): value is BotMascotShape =>
  (BOT_MASCOT_SHAPES as ReadonlyArray<string>).includes(value);

export function botMascotTag(shape: BotMascotShape): string {
  return `${BOT_THREAD_TAG_PREFIX_MASCOT}${shape}`;
}

/** The mascot a bot was given, or one picked from its id so an untagged bot still has a face. */
export function botMascotShape(thread: BotThreadFields & { readonly id: string }): BotMascotShape {
  for (const tag of thread.source?.tags ?? []) {
    const name = tag.startsWith(BOT_THREAD_TAG_PREFIX_MASCOT)
      ? tag.slice(BOT_THREAD_TAG_PREFIX_MASCOT.length)
      : "";
    if (isShape(name)) return name;
  }
  let hash = 0;
  for (const char of thread.id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return BOT_MASCOT_SHAPES[hash % BOT_MASCOT_SHAPES.length] ?? "Classic";
}

/** The first mascot no listed bot wears yet, so new bots look different while there are faces left. */
export function nextBotMascotShape(taken: ReadonlyArray<BotMascotShape>): BotMascotShape {
  return BOT_MASCOT_SHAPES.find((shape) => !taken.includes(shape)) ?? "Classic";
}

/**
 * How a bot's face reads its thread: thinking while it works, happy with something to tell you,
 * crossed out when a run failed, asleep between wakes. It is awake while you have it open, and
 * whenever it is waiting on you.
 */
export function botMascotMood(input: {
  readonly status: string;
  readonly isUnread: boolean;
  /** False while the bot's conversation is the one on screen. */
  readonly resting: boolean;
}): BotMascotMood {
  if (input.status === "failed" || input.status === "limited") return "Error";
  if (input.status === "working" || input.status === "preparing") return "Thinking";
  if (input.isUnread) return "Happy";
  return input.status === "ready" && input.resting ? "Sleeping" : "Idle";
}
