/**
 * The bead ring working mark's motion, ported from the Mac fork's drawBeadRing (56x56 units) —
 * see `.fork/customizations.yaml#no3y-mobile-redesign`. Pieces are round-capped arcs (the Mac also
 * fills necks), one path the UI thread rebuilds each frame.
 */

/** Seconds per loop. */
export const BEAD_RING_PERIOD = 1.9;
const RING_RADIUS = 20;
/** Half the line's thickness. */
export const BEAD_RING_HALF_WIDTH = 2.5;
const PIECES = 4;
const LINE_LENGTH = 38;
/** The gap between pieces once they are fully apart. */
const GAP = 13.2;
/** One loop turns exactly once, so a loop repeats as drawn with no rotation layer. */
const SPIN = (2 * Math.PI - (PIECES * GAP) / RING_RADIUS) / BEAD_RING_PERIOD;

/** The SVG path (56x56 units, stroke it 2 x half width, round caps) at `progress` 0..1 of a loop. */
export function beadRingPath(progress: number): string {
  "worklet";
  const p = progress - Math.floor(progress);
  const t = p * BEAD_RING_PERIOD;
  const pulling = p < 0.5;
  const gaps: number[] = [];
  let strung = 0;
  // Gaps open in turn from the line back (0.18 apart), and close the other way round.
  for (let k = 0; k < PIECES; k++) {
    const raw = ((pulling ? p : p - 0.5) * 2 - (pulling ? k : PIECES - 1 - k) * 0.18) / 0.46;
    const q = 0.5 - 0.5 * Math.cos(Math.max(0, Math.min(1, raw)) * Math.PI);
    const gap = GAP * (pulling ? q : 1 - q);
    gaps.push(gap);
    strung += gap;
  }
  // The line's trailing end: a steady spin, plus the line moving on while it pulls.
  const tailOfLine = t * SPIN + (pulling ? strung : PIECES * GAP) / RING_RADIUS;
  const tails = [tailOfLine];
  const heads = [tailOfLine + LINE_LENGTH / RING_RADIUS];
  for (let k = 0; k < PIECES; k++) {
    const front = tails[k]! - gaps[k]! / RING_RADIUS;
    heads.push(front);
    // 6 units long, shrinking to a dot.
    tails.push(front - (6 - (6 * k) / (PIECES - 1)) / RING_RADIUS);
  }
  let d = "";
  for (let k = 0; k <= PIECES; k++) {
    const from = tails[k]!;
    // A dot still needs a sliver of arc for its round caps to draw.
    const to = Math.max(heads[k]!, from + 0.001);
    const x1 = 28 + RING_RADIUS * Math.cos(from);
    const y1 = 28 + RING_RADIUS * Math.sin(from);
    const x2 = 28 + RING_RADIUS * Math.cos(to);
    const y2 = 28 + RING_RADIUS * Math.sin(to);
    const large = to - from > Math.PI ? 1 : 0;
    d += `M${x1.toFixed(3)} ${y1.toFixed(3)}A${RING_RADIUS} ${RING_RADIUS} 0 ${large} 1 ${x2.toFixed(3)} ${y2.toFixed(3)}`;
  }
  return d;
}

/** The still frame shown under Reduce Motion: the Mac's design frame, t = 1.1s. */
export const BEAD_RING_STILL_PROGRESS = 1.1 / BEAD_RING_PERIOD;
