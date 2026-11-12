import { GLYPH_GROUPS, GLYPH_SIZE, SLOT_COLORS, type Glyph } from "./pixelTextureGlyphs";

/**
 * The portfolio's `TextureCanvas` (`src/components/PixelTexture.tsx`) cut to its Landing
 * preset: the Edge mirrored in from the right, Leaf-palette patches, bold faces, size S,
 * streaks, flow and sway, a near field. A cell is 20 glyph units, each a whole number of
 * device pixels; a frame redraws only the cells that changed.
 */
const CELL_UNITS = 20;
const FAINT = 0.09;
const NEAR_ROWS = 2;
/** The outermost near row's strength, as a share of the first's. */
const NEAR_FADE = 0.45;

const STREAK_MAX = 5;
const STREAK_GAP: [number, number] = [220, 900];
const STREAK_LEN: [number, number] = [3, 11];
const STREAK_SPEED: [number, number] = [14, 32];
const STREAK_BAR = 0.3;
/** Chance a cell in a streak takes a colour of its own rather than the streak's. */
const STREAK_MIX = 0.3;
const FLOW_SPEED: [number, number] = [0.5, 1.4];
const FLOW_STEP_MS = 140;
const SWAY_REACH = 1.1;
const SWAY_PACE = 0.00035;
const SWAY_STEP_MS = 110;
/** Nothing moves faster than a streak's 32 cells a second, so frames this far apart (about
    30–40 a second) draw what every vsync would, without waking the page 120 times a second. */
const FRAME_GAP_MS = 20;
/** The line eases back to its side over the grid's last 12% so the shape slopes away at the foot. */
const TAPER_SHARE = 0.12;
const CELLS_PER_PATCH = 26;
const BLEED_REACH = 2;
const BLEED_WARP = 1.4;
const FAMILIES = SLOT_COLORS.length / 2;

/** The Landing line, `[reach from the side, down]` as shares of the box. */
const LANDING_LINE: [number, number][] = [
  [0.62, 0],
  [0.78, 0.05],
  [0.85, 0.1],
  [0.8, 0.145],
  [0.62, 0.185],
  [0.45, 0.22],
  [0.42, 0.26],
  [0.52, 0.3],
  [0.6, 0.34],
  [0.58, 0.38],
  [0.48, 0.43],
  [0.3, 0.47],
  [0.24, 0.53],
  [0.34, 0.57],
  [0.6, 0.6],
  [0.72, 0.62],
  [0.74, 0.66],
  [0.56, 0.72],
  [0.46, 0.79],
  [0.5, 0.86],
  [0.62, 0.92],
  [0.7, 1],
];

/** Catmull-Rom samples of the line, 8 a segment. */
function sampleLine(p: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)]!;
    const p1 = p[i]!;
    const p2 = p[i + 1]!;
    const p3 = p[Math.min(p.length - 1, i + 2)]!;
    for (let step = 0; step < 8; step++) {
      const t = step / 8;
      const t2 = t * t;
      const t3 = t2 * t;
      const at = (k: 0 | 1) =>
        0.5 *
        (2 * p1[k] +
          (-p0[k] + p2[k]) * t +
          (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
          (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      out.push([at(0), at(1)]);
    }
  }
  out.push(p[p.length - 1]!);
  return out;
}

const EDGE_SAMPLES = sampleLine(LANDING_LINE);

/**
 * `field` the faint background glyph; inside the shape, `tile` a filled square with the
 * glyph cut into it, `ink` the glyph alone, `solid` the bare square, `frame` an outline.
 */
type Kind = "field" | "tile" | "ink" | "solid" | "frame";
/** Dealt round the patch seeds in turn, so every treatment shows up. */
const PATCH_KINDS: Kind[] = ["tile", "ink", "solid", "frame", "ink", "tile"];

type Cell = {
  x: number;
  y: number;
  kind: Kind;
  /** `SLOT_COLORS` index, or -1 for a field cell. */
  slot: number;
  /** Light level 0–3, brightest along the edge. */
  level: number;
  /** Index into `GLYPHS`, or -1 for a blank tile. */
  glyph: number;
  next: number;
  /** Rings out from the shape (0 inside it), for the near field. */
  near: number;
  rim: boolean;
  seed: number;
  /** A streak's bar colour slot over the cell, or -1. */
  dash: number;
};

type Streak = {
  y: number;
  head: number;
  from: number;
  len: number;
  speed: number;
  covered: Cell[];
};

const GLYPHS: Glyph[] = GLYPH_GROUPS.flat();
const GROUP_STARTS = GLYPH_GROUPS.map((_, i) =>
  GLYPH_GROUPS.slice(0, i).reduce((n, group) => n + group.length, 0),
);

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function pick(not = -1) {
  let g = not;
  while (g === not) {
    const i = Math.floor(Math.random() * GLYPH_GROUPS.length);
    g = GROUP_STARTS[i]! + Math.floor(Math.random() * GLYPH_GROUPS[i]!.length);
  }
  return g;
}

const blank = (kind: Kind) => kind === "tile" && Math.random() < 0.06;
const edgeLevel = (dist: number) => (dist < 1.2 ? 3 : dist < 3 ? 2 : dist < 6 ? 1 : 0);

/**
 * When motion stops. The first build fixes the deadline, so a later rebuild (a resize, a
 * colour change) past it draws a still frame instead of restarting; `animateUntil` is null
 * when the build should draw one still frame.
 */
export function settleTexture(
  settleAt: number | null,
  now: number,
  settleMs: number,
  reducedMotion: boolean,
) {
  const at = settleAt ?? now + settleMs;
  return { settleAt: at, animateUntil: reducedMotion || now >= at ? null : at };
}

/**
 * Builds the texture for a `width` × `height` CSS px box, draws it, and animates it until
 * `animateUntil` (a `performance.now()` time), then holds the last frame. Returns the cleanup.
 */
export function paintPixelTexture(
  canvas: HTMLCanvasElement,
  box: { width: number; height: number },
  colors: { ground: string; text: string },
  animateUntil: number | null,
): () => void {
  const ctx = canvas.getContext("2d");
  const maskCtx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!ctx || !maskCtx) return () => {};
  const { ground, text } = colors;

  const dpr = window.devicePixelRatio || 1;
  const u = Math.max(1, Math.round(dpr));
  const cell = CELL_UNITS * u;
  const glyphOff = ((CELL_UNITS - GLYPH_SIZE) / 2) * u;
  const inset = glyphOff / 2;
  const side = cell - 2 * inset;
  const bar = Math.max(u, Math.round(cell * STREAK_BAR));
  const cols = Math.max(8, Math.floor((box.width * dpr) / cell));
  const rows = Math.max(8, Math.floor((box.height * dpr) / cell));
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  canvas.style.width = `${(cols * cell) / dpr}px`;
  canvas.style.height = `${(rows * cell) / dpr}px`;

  const sprites = new Map<string, HTMLCanvasElement>();
  const sprite = (g: number, ink: string) => {
    const key = `${g}|${ink}`;
    let s = sprites.get(key);
    if (!s) {
      s = document.createElement("canvas");
      s.width = s.height = GLYPH_SIZE * u;
      const sctx = s.getContext("2d")!;
      sctx.fillStyle = ink;
      for (const [x, y, w, h] of GLYPHS[g]!) sctx.fillRect(x * u, y * u, w * u, h * u);
      sprites.set(key, s);
    }
    return s;
  };
  const glyphAt = (g: number, ink: string, px: number, py: number) =>
    ctx.drawImage(sprite(g, ink), px + glyphOff, py + glyphOff);

  // Patches: each cell takes the nearest of a few drifting seeds' colour and treatment, the
  // borders warped by fixed waves and dithered near a border by each cell's fixed chance.
  const seedCount = Math.max(6, Math.min(180, Math.round((cols * rows) / CELLS_PER_PATCH)));
  const seeds = Array.from({ length: seedCount }, (_, i) => {
    const angle = rand(0, Math.PI * 2);
    const pace = rand(...FLOW_SPEED);
    return {
      x: rand(0, cols),
      y: rand(0, rows),
      vx: Math.cos(angle) * pace,
      vy: Math.sin(angle) * pace,
      family: i < FAMILIES ? i : Math.floor(Math.random() * FAMILIES),
      kind: PATCH_KINDS[i] ?? PATCH_KINDS[Math.floor(Math.random() * PATCH_KINDS.length)] ?? "tile",
    };
  });
  const phase = Array.from({ length: 4 }, () => rand(0, Math.PI * 2));
  const jitter = Float32Array.from({ length: cols * rows }, () => Math.random());
  const seedIndexAt = (x: number, y: number) => {
    const wx =
      x +
      BLEED_WARP *
        (Math.sin(y * 0.31 + phase[0]!) + 0.5 * Math.sin(y * 0.73 + x * 0.21 + phase[1]!));
    const wy =
      y +
      BLEED_WARP *
        (Math.sin(x * 0.29 + phase[2]!) + 0.5 * Math.sin(x * 0.67 - y * 0.19 + phase[3]!));
    let first = 0;
    let second = 0;
    let d1 = Infinity;
    let d2 = Infinity;
    seeds.forEach((seed, i) => {
      const d = (seed.x - wx) ** 2 + (seed.y - wy) ** 2;
      if (d < d1) {
        d2 = d1;
        second = first;
        d1 = d;
        first = i;
      } else if (d < d2) {
        d2 = d;
        second = i;
      }
    });
    const gap = Math.sqrt(d2) - Math.sqrt(d1);
    if (gap < BLEED_REACH && (jitter[y * cols + x] ?? 1) < 0.5 * (1 - gap / BLEED_REACH)) {
      return second;
    }
    return first;
  };

  /** Rim cells may break up into bare glyphs. */
  const treat = (seed: number, rim: boolean): Kind =>
    rim && Math.random() < 0.45 ? "ink" : seeds[seed]!.kind;
  /** A bare glyph or frame never drops to the dim half, or it vanishes on the ground. */
  const slotFor = (seed: number, level: number, kind: Kind) => {
    const l = kind === "ink" || kind === "frame" ? Math.max(level, 2) : level;
    return seeds[seed]!.family * 2 + (l >= 2 ? 1 : 0);
  };

  // The area right of the line, filled on a grid-sized canvas (a cell is in when its pixel
  // is mostly covered), with each cell's distance to the line for its light level.
  const edgeField = (swayPhase: number) => {
    const line = EDGE_SAMPLES.map(([nx, ny]): [number, number] => {
      const drift =
        SWAY_REACH *
        (Math.sin(Math.PI * 2 * ny * 1.6 + swayPhase) +
          0.4 * Math.sin(Math.PI * 2 * ny * 3.1 - swayPhase * 1.7));
      const t = Math.min(1, Math.max(0, (1 - ny) / TAPER_SHARE));
      const x = (nx * cols + drift) * t * t * (3 - 2 * t);
      return [cols - x, ny * rows];
    });
    maskCtx.canvas.width = cols;
    maskCtx.canvas.height = rows;
    maskCtx.beginPath();
    maskCtx.moveTo(cols + 2, -2);
    maskCtx.lineTo(line[0]![0], -2);
    for (const [x, y] of line) maskCtx.lineTo(x, y);
    maskCtx.lineTo(line.at(-1)![0], rows + 2);
    maskCtx.lineTo(cols + 2, rows + 2);
    maskCtx.closePath();
    maskCtx.fill();
    const alpha = maskCtx.getImageData(0, 0, cols, rows).data;
    const inside = new Uint8Array(cols * rows);
    const dist = new Float32Array(cols * rows);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        if ((alpha[i * 4 + 3] ?? 0) <= 127) continue;
        inside[i] = 1;
        let best = Infinity;
        for (const [lx, ly] of line)
          best = Math.min(best, (lx - x - 0.5) ** 2 + (ly - y - 0.5) ** 2);
        dist[i] = Math.sqrt(best);
      }
    }
    return { inside, dist };
  };

  const now0 = performance.now();
  const edge = edgeField(0);
  const cells: Cell[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      let kind: Kind = "field";
      let slot = -1;
      let level = 0;
      let rim = false;
      let seed = -1;
      if (edge.inside[i]) {
        const dist = edge.dist[i] ?? 0;
        level = edgeLevel(dist);
        rim = dist < 0.9;
        seed = seedIndexAt(x, y);
        kind = treat(seed, rim);
        slot = slotFor(seed, level, kind);
      }
      cells.push({
        x,
        y,
        kind,
        slot,
        level,
        glyph: blank(kind) ? -1 : pick(),
        next: now0 + rand(0, 3000),
        near: 0,
        rim,
        seed,
        dash: -1,
      });
    }
  }

  // Each cell's rings of neighbours out from the shape, up to the near field's reach;
  // returns the cells whose count changed, so a swaying edge redraws just those.
  const measureNear = () => {
    const next = new Uint16Array(cells.length).fill(NEAR_ROWS + 1);
    let ring: number[] = [];
    cells.forEach((c, i) => {
      if (c.kind !== "field") {
        next[i] = 0;
        ring.push(i);
      }
    });
    for (let step = 1; step <= NEAR_ROWS && ring.length; step++) {
      const out: number[] = [];
      for (const i of ring) {
        const x = i % cols;
        const y = (i - x) / cols;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            const j = ny * cols + nx;
            if ((next[j] ?? 0) <= step) continue;
            next[j] = step;
            out.push(j);
          }
        }
      }
      ring = out;
    }
    const changed: Cell[] = [];
    cells.forEach((c, i) => {
      const near = next[i] ?? 0;
      if (c.near !== near) {
        c.near = near;
        changed.push(c);
      }
    });
    return changed;
  };
  measureNear();
  const fieldAlpha = (c: Cell) => {
    if (c.near > NEAR_ROWS) return 0;
    return FAINT * (1 - ((c.near - 1) / (NEAR_ROWS - 1)) * (1 - NEAR_FADE));
  };

  // Cells the swaying line passes over come in or go out; the ones that stay take their
  // new light level's colour, their treatment held so the inside doesn't churn.
  const applyInside = (next: ReturnType<typeof edgeField>, out: Set<Cell>) => {
    for (const c of cells) {
      const i = c.y * cols + c.x;
      const was = c.kind !== "field";
      if (!next.inside[i]) {
        if (!was) continue;
        c.kind = "field";
        c.slot = -1;
        c.level = 0;
        out.add(c);
        continue;
      }
      const dist = next.dist[i] ?? 0;
      const level = edgeLevel(dist);
      if (!was) {
        c.rim = dist < 0.9;
        c.seed = seedIndexAt(c.x, c.y);
        c.kind = treat(c.seed, c.rim);
        c.level = level;
        c.slot = slotFor(c.seed, level, c.kind);
        if (blank(c.kind)) c.glyph = -1;
        out.add(c);
      } else if (level !== c.level) {
        c.level = level;
        c.slot = slotFor(c.seed, level, c.kind);
        out.add(c);
      }
    }
    for (const c of measureNear()) out.add(c);
  };

  const draw = (c: Cell) => {
    const px = c.x * cell;
    const py = c.y * cell;
    ctx.clearRect(px, py, cell, cell);
    if (c.kind === "field") {
      const alpha = fieldAlpha(c);
      if (c.glyph < 0 || alpha === 0) return;
      ctx.globalAlpha = alpha;
      glyphAt(c.glyph, text, px, py);
      ctx.globalAlpha = 1;
      return;
    }
    if (c.dash >= 0) {
      ctx.fillStyle = SLOT_COLORS[c.dash]!;
      ctx.fillRect(px + inset, py + Math.round((cell - bar) / 2), side, bar);
      return;
    }
    const ink = SLOT_COLORS[c.slot]!;
    if (c.kind === "tile" || c.kind === "solid") {
      ctx.fillStyle = ink;
      ctx.fillRect(px + inset, py + inset, side, side);
      if (c.kind === "tile" && c.glyph >= 0) glyphAt(c.glyph, ground, px, py);
      return;
    }
    if (c.kind === "frame") {
      ctx.fillStyle = ink;
      ctx.fillRect(px + inset, py + inset, side, u);
      ctx.fillRect(px + inset, py + cell - inset - u, side, u);
      ctx.fillRect(px + inset, py + inset, u, side);
      ctx.fillRect(px + cell - inset - u, py + inset, u, side);
    }
    if (c.glyph >= 0) glyphAt(c.glyph, ink, px, py);
  };

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  cells.forEach(draw);
  if (animateUntil === null) return () => {};

  const flip = (c: Cell) => {
    c.glyph = blank(c.kind) ? -1 : pick(c.glyph);
  };
  const dirty = new Set<Cell>();
  const running: Streak[] = [];
  const streakSlot = () => Math.floor(Math.random() * SLOT_COLORS.length);
  const spawnStreak = (y: number) => {
    const row = cells.slice(y * cols, (y + 1) * cols).filter((c) => c.kind !== "field");
    if (!row.length) return;
    // Mostly from the right, the side the shape comes in from.
    const start = row[row.length - 1 - Math.floor(Math.random() ** 2 * row.length)]!.x;
    running.push({
      y,
      head: start,
      from: start,
      len: Math.round(rand(...STREAK_LEN)),
      speed: rand(...STREAK_SPEED),
      covered: [],
    });
  };

  let nextSway = now0 + SWAY_STEP_MS;
  let nextFlow = now0 + FLOW_STEP_MS;
  let lastFlow = now0;
  let nextStreak = now0 + 600;
  let last = now0;
  let frame = 0;
  let timer = 0;
  // Time spent paused in the background, taken off the clock so nothing jumps on return.
  let pausedFor = 0;
  let pausedAt: number | null = null;

  const tick = (time: number) => {
    const now = time - pausedFor;
    // Past the deadline nothing is drawn or scheduled: the last frame holds.
    if (now >= animateUntil) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    for (const c of cells) {
      if (now >= c.next) {
        flip(c);
        dirty.add(c);
        c.next = now + (c.kind === "field" ? rand(1800, 9000) : rand(500, 3600));
      }
    }
    if (now >= nextSway) {
      nextSway = now + SWAY_STEP_MS;
      applyInside(edgeField((now - now0) * SWAY_PACE), dirty);
    }
    // Streaks: runs of cells along a row collapse into bars that slide right to left,
    // the cells they leave coming back with new glyphs.
    if (now >= nextStreak) {
      nextStreak = now + rand(...STREAK_GAP);
      if (running.length < STREAK_MAX) {
        const y = Math.floor(Math.random() * rows);
        const band = Math.random() < 0.35 ? 1 + Math.floor(Math.random() * 2) : 0;
        for (let k = 0; k <= band; k++) if (y + k < rows) spawnStreak(y + k);
      }
    }
    for (let i = running.length - 1; i >= 0; i--) {
      const streak = running[i]!;
      streak.head -= streak.speed * dt;
      const headX = Math.floor(streak.head);
      const tailX = headX + streak.len - 1;
      const under: Cell[] = [];
      for (let x = Math.max(0, headX); x <= Math.min(streak.from, tailX); x++) {
        const c = cells[streak.y * cols + x]!;
        if (c.kind !== "field") under.push(c);
      }
      for (const c of streak.covered) {
        if (under.includes(c)) continue;
        c.dash = -1;
        flip(c);
        dirty.add(c);
      }
      const base = streakSlot();
      for (const c of under) {
        if (c.dash >= 0) continue;
        c.dash = Math.random() < STREAK_MIX ? streakSlot() : base;
        dirty.add(c);
      }
      streak.covered = under;
      if (tailX < 0) running.splice(i, 1);
    }
    // Flow: the seeds drift, bouncing off a margin round the grid, and a cell that has
    // changed patch takes the new one's treatment and colour.
    if (now >= nextFlow) {
      const step = Math.min(0.3, (now - lastFlow) / 1000);
      lastFlow = now;
      nextFlow = now + FLOW_STEP_MS;
      for (const seed of seeds) {
        seed.x += seed.vx * step;
        seed.y += seed.vy * step;
        if (seed.x < -3 || seed.x > cols + 3) seed.vx *= -1;
        if (seed.y < -3 || seed.y > rows + 3) seed.vy *= -1;
      }
      for (const c of cells) {
        if (c.kind === "field") continue;
        const s = seedIndexAt(c.x, c.y);
        if (s === c.seed) continue;
        c.seed = s;
        c.kind = treat(s, c.rim);
        c.slot = slotFor(s, c.level, c.kind);
        dirty.add(c);
      }
    }
    dirty.forEach(draw);
    dirty.clear();
    timer = window.setTimeout(() => {
      frame = requestAnimationFrame(tick);
    }, FRAME_GAP_MS);
  };

  // Holds while the window is in the background (another app focused) and picks up on return.
  const pause = () => {
    if (pausedAt !== null) return;
    pausedAt = performance.now();
    cancelAnimationFrame(frame);
    window.clearTimeout(timer);
  };
  const resume = () => {
    if (pausedAt === null) return;
    pausedFor += performance.now() - pausedAt;
    pausedAt = null;
    frame = requestAnimationFrame(tick);
  };
  window.addEventListener("blur", pause);
  window.addEventListener("focus", resume);
  if (document.hasFocus()) frame = requestAnimationFrame(tick);
  else pausedAt = performance.now();
  return () => {
    cancelAnimationFrame(frame);
    window.clearTimeout(timer);
    window.removeEventListener("blur", pause);
    window.removeEventListener("focus", resume);
  };
}
