/**
 * Bead ring working mark — see `.fork/customizations.yaml#fork-working-mark`. A line round a
 * ring whose tail stretches into beads, snaps them loose and merges them back; 56×56 units.
 */

/** Seconds per loop. */
export const BEAD_RING_PERIOD = 1.9;
const RING_RADIUS = 20;
/** Half the line's thickness. */
const HALF_WIDTH = 2.5;
const PIECES = 4;
const LINE_LENGTH = 38;
/** The gap between pieces once they are fully apart. */
const GAP = 13.2;
/** The steady spin (rad/s, ~1.92), set so that with the line moving on by every gap a loop turns
    exactly once: a loop then repeats as drawn and plays as one film, with no rotation layer. */
const SPIN = (2 * Math.PI - (PIECES * GAP) / RING_RADIUS) / BEAD_RING_PERIOD;

/** Draws one frame. `t` is seconds since start. Expects a 56×56 unit transform. */
export function drawBeadRing(t: number, ctx: CanvasRenderingContext2D, color: string): void {
  const R = RING_RADIUS;
  const r = HALF_WIDTH;
  const n = PIECES;
  const M = n * GAP;
  const cycle = Math.floor(t / BEAD_RING_PERIOD);
  const p = t / BEAD_RING_PERIOD - cycle;
  const pulling = p < 0.5;
  const gaps: number[] = [];
  // How far the pieces are strung out in all.
  let strung = 0;
  // Each gap has its own timing: they open in turn from the line back (0.18 apart), and close
  // the other way round.
  for (let k = 0; k < n; k++) {
    const raw = ((pulling ? p : p - 0.5) * 2 - (pulling ? k : n - 1 - k) * 0.18) / 0.46;
    const q = 0.5 - 0.5 * Math.cos(Math.max(0, Math.min(1, raw)) * Math.PI);
    gaps.push(GAP * (pulling ? q : 1 - q));
    strung += gaps[k]!;
  }
  // The line's trailing end (an angle): a steady spin, plus the line moving on while it pulls
  // and holding while the pieces catch up.
  const B = t * SPIN + (cycle * M + (pulling ? strung : M)) / R;
  // Each piece's back and front end (angles): the line first, then the pieces going backwards.
  // Every end is round, and `back`/`forward` say how far it reaches (r is round).
  const tails = [B];
  const heads = [B + LINE_LENGTH / R];
  const back = [r];
  const forward = [r];
  for (let k = 0; k < n; k++) {
    const front = tails[k]! - gaps[k]! / R;
    heads.push(front);
    tails.push(front - (6 - (6 * k) / (n - 1)) / R); // 6 long, shrinking to a dot
    back.push(r);
    forward.push(r);
  }
  ctx.strokeStyle = ctx.fillStyle = color;
  ctx.lineWidth = 2 * r;
  ctx.lineCap = "round";
  // Fills a shape along the ring from angle a to b, hw(x) units either side at x = 0..1.
  const band = (a: number, b: number, hw: (x: number) => number) => {
    ctx.beginPath();
    for (let i = 0; i <= 56; i++) {
      const x = i < 29 ? i / 28 : (56 - i) / 28;
      const d = R + (i < 29 ? 1 : -1) * hw(x);
      const angle = a + (b - a) * x;
      ctx.lineTo(28 + d * Math.cos(angle), 28 + d * Math.sin(angle));
    }
    ctx.fill();
  };
  // A round end at angle a, reaching `reachBack` units backwards and `reachForward` forwards.
  const end = (a: number, reachBack: number, reachForward: number) => {
    ctx.beginPath();
    for (let i = 0; i < 32; i++) {
      const f = (i / 32) * 2 * Math.PI;
      const x = Math.cos(f) * (Math.cos(f) > 0 ? reachForward : reachBack);
      const d = R + r * Math.sin(f);
      ctx.lineTo(28 + d * Math.cos(a + x / R), 28 + d * Math.sin(a + x / R));
    }
    ctx.fill();
  };
  for (let k = 0; k < n; k++) {
    const a = heads[k + 1]!;
    const b = tails[k]!;
    const D = (b - a) * R;
    // Stretching, a neck holds until the pieces are 9.5 apart; coming back together, it only
    // forms once they're within 7.
    if (D < (pulling ? 9.5 : 7)) {
      // The waist narrows the further apart they are, curving smoothly into both ends (along a
      // circle of radius f that touches each one).
      const e = Math.max(0, Math.min(1, (D - 3.5) / 5.5));
      const m = 0.2 + 0.8 * (1 - e) * (1 - e); // the waist, as a share of the line's width
      if (m > 0.995 || D / 2 <= r * Math.sqrt(1 - m * m)) {
        band(a, b, () => r);
      } else {
        const f = ((D * D) / 4 - r * r * (1 - m * m)) / (2 * r * (1 - m));
        const h = f + m * r;
        const w = ((D / 2) * f) / (r + f);
        band(a, b, (x) => {
          const X = Math.abs(x - 0.5) * D;
          return X <= w
            ? h - Math.sqrt(f * f - X * X)
            : Math.sqrt(Math.max(0, r * r - (D / 2 - X) * (D / 2 - X)));
        });
      }
    } else {
      // Apart: just after a snap both ends spring back with a wobble; coming together, they
      // reach for each other.
      const g = pulling ? Math.max(0, 1 - (D - 9.5) / 2.5) : Math.max(0, 1 - (D - 7) / 3) * 0.4;
      const s = 1 + (pulling ? 0.6 * g * Math.cos((1 - g) * 4) : g);
      forward[k + 1] = r * s;
      back[k] = r * s;
    }
  }
  for (let k = 0; k <= n; k++) {
    if (heads[k]! > tails[k]!) {
      ctx.beginPath();
      ctx.arc(28, 28, R, tails[k]!, heads[k]!);
      ctx.stroke();
    }
    end(tails[k]!, back[k]!, r);
    end(heads[k]!, r, forward[k]!);
  }
}

/** A mask that hides everything, for a browser without a 2D canvas. */
const EMPTY_FILM = "linear-gradient(transparent, transparent)";

/** One loop as a vertical strip of `frames` square frames, `framePx` each, for the working mark's
    film mask. */
export function bakeBeadRingFilm(frames: number, framePx: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = framePx;
  canvas.height = framePx * frames;
  const ctx = canvas.getContext("2d");
  if (ctx === null) return EMPTY_FILM;
  const scale = framePx / 56;
  for (let index = 0; index < frames; index++) {
    ctx.setTransform(scale, 0, 0, scale, 0, index * framePx);
    drawBeadRing(((index + 0.5) / frames) * BEAD_RING_PERIOD, ctx, "#000");
  }
  const dataUrl = canvas.toDataURL("image/png");
  const bytes = Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(",") + 1)), (char) =>
    char.charCodeAt(0),
  );
  // A blob URL rather than the data URI, as the other films: every strip names it inline.
  return `url("${URL.createObjectURL(new Blob([bytes], { type: "image/png" }))}")`;
}
