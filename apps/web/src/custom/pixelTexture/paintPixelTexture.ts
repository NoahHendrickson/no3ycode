import { GLYPH_GROUPS, GLYPH_SIZE, SLOT_COLORS, type Glyph } from "./pixelTextureGlyphs";
import { createTextureModel, NEAR_ROWS, type TextureCell } from "./textureModel";

/** A cell is 20 glyph units, each a whole number of device pixels. */
const CELL_UNITS = 20;
const FAINT = 0.09;
/** The outermost near row's strength, as a share of the first's. */
const NEAR_FADE = 0.45;
const STREAK_BAR = 0.3;
/** Nothing moves faster than a streak's 32 cells a second, so frames this far apart (about
    30–40 a second) draw what every vsync would, without waking the page 120 times a second. */
const FRAME_GAP_MS = 20;

const GLYPHS: Glyph[] = GLYPH_GROUPS.flat();

export type TextureGrid = { cols: number; rows: number; unit: number };

/** The whole cells that fit a `width` × `height` CSS px box at `dpr`. */
export function textureGrid(box: { width: number; height: number }, dpr: number): TextureGrid {
  const unit = Math.max(1, Math.round(dpr));
  const cell = CELL_UNITS * unit;
  return {
    cols: Math.max(8, Math.floor((box.width * dpr) / cell)),
    rows: Math.max(8, Math.floor((box.height * dpr) / cell)),
    unit,
  };
}

type Metrics = ReturnType<typeof cellMetrics>;

function cellMetrics(u: number) {
  const cell = CELL_UNITS * u;
  const glyphOff = ((CELL_UNITS - GLYPH_SIZE) / 2) * u;
  const inset = glyphOff / 2;
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
  return {
    u,
    cell,
    glyphOff,
    inset,
    side: cell - 2 * inset,
    bar: Math.max(u, Math.round(cell * STREAK_BAR)),
    sprite,
  };
}

const fieldAlpha = (c: TextureCell) =>
  c.near > NEAR_ROWS ? 0 : FAINT * (1 - ((c.near - 1) / (NEAR_ROWS - 1)) * (1 - NEAR_FADE));

/** Redraws one cell; `ground` is the surface behind the canvas, cut into the tiles' glyphs. */
function drawCell(
  ctx: CanvasRenderingContext2D,
  c: TextureCell,
  colors: { ground: string; text: string },
  m: Metrics,
) {
  const { u, cell, inset, side } = m;
  const px = c.x * cell;
  const py = c.y * cell;
  const glyphAt = (ink: string) =>
    ctx.drawImage(m.sprite(c.glyph, ink), px + m.glyphOff, py + m.glyphOff);
  ctx.clearRect(px, py, cell, cell);
  if (c.kind === "field") {
    const alpha = fieldAlpha(c);
    if (c.glyph < 0 || alpha === 0) return;
    ctx.globalAlpha = alpha;
    glyphAt(colors.text);
    ctx.globalAlpha = 1;
    return;
  }
  if (c.dash >= 0) {
    ctx.fillStyle = SLOT_COLORS[c.dash]!;
    ctx.fillRect(px + inset, py + Math.round((cell - m.bar) / 2), side, m.bar);
    return;
  }
  const ink = SLOT_COLORS[c.slot]!;
  if (c.kind === "tile" || c.kind === "solid") {
    ctx.fillStyle = ink;
    ctx.fillRect(px + inset, py + inset, side, side);
    if (c.kind === "tile" && c.glyph >= 0) glyphAt(colors.ground);
    return;
  }
  if (c.kind === "frame") {
    ctx.fillStyle = ink;
    ctx.fillRect(px + inset, py + inset, side, u);
    ctx.fillRect(px + inset, py + cell - inset - u, side, u);
    ctx.fillRect(px + inset, py + inset, u, side);
    ctx.fillRect(px + cell - inset - u, py + inset, u, side);
  }
  if (c.glyph >= 0) glyphAt(ink);
}

/**
 * Deals a texture for `grid`, draws it, and, when `animate`, keeps it moving, a frame
 * redrawing only the cells that changed. Returns the cleanup.
 */
export function paintPixelTexture(
  canvas: HTMLCanvasElement,
  grid: TextureGrid,
  colors: { ground: string; text: string },
  animate: boolean,
): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const metrics = cellMetrics(grid.unit);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = grid.cols * metrics.cell;
  canvas.height = grid.rows * metrics.cell;
  canvas.style.width = `${canvas.width / dpr}px`;
  canvas.style.height = `${canvas.height / dpr}px`;

  const model = createTextureModel(grid.cols, grid.rows, Math.random);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const c of model.cells) drawCell(ctx, c, colors, metrics);
  if (!animate) return () => {};

  const start = performance.now();
  let last = 0;
  let frame = 0;
  let timer = 0;
  // Time spent paused in the background, taken off the clock so nothing jumps on return.
  let pausedFor = 0;
  let pausedAt: number | null = null;

  const tick = (time: number) => {
    const now = Math.max(last, time - start - pausedFor);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    for (const c of model.step(now, dt)) drawCell(ctx, c, colors, metrics);
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
