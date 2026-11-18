/**
 * The effort slider's fill — see `.fork/customizations.yaml#fork-model-picker`: an ordered
 * (Bayer) dither through the selected provider's colours, from the track's start to the middle
 * of the thumb.
 */
import { ProviderDriverKind } from "@t3tools/contracts";
import { useId } from "react";

import { CLAUDE_INK, CODEX_INK } from "./icons/ModelPickerProviderGlyph";

/** The fill's colours from the track's start to the thumb: at least two. */
export type EffortDitherStops = readonly [string, string, ...string[]];

const EFFORT_DITHER_STOPS: Partial<Record<ProviderDriverKind, EffortDitherStops>> = {
  [ProviderDriverKind.make("claudeAgent")]: ["#8f3f26", CLAUDE_INK, "#f3b38e"],
  [ProviderDriverKind.make("codex")]: ["#3d36b8", CODEX_INK],
  // Antigravity's arch.
  [ProviderDriverKind.make("antigravity")]: ["#f43f7f", "#4285f4", "#1ee36e"],
  [ProviderDriverKind.make("grok")]: ["#ffffff", "#000000"],
  [ProviderDriverKind.make("cursor")]: ["#ffffff", "#000000"],
};

const DEFAULT_EFFORT_DITHER_STOPS: EffortDitherStops = [
  "var(--sidebar-v2-status-done)",
  "var(--sidebar-v2-status-working)",
];

export function effortDitherStops(driver: ProviderDriverKind): EffortDitherStops {
  return EFFORT_DITHER_STOPS[driver] ?? DEFAULT_EFFORT_DITHER_STOPS;
}

/** An n x n Bayer matrix, n a power of two: the order its cells turn on as the level rises. */
export function bayerMatrix(size: number): ReadonlyArray<ReadonlyArray<number>> {
  if (size === 1) return [[0]];
  const half = size / 2;
  const inner = bayerMatrix(half);
  return Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => {
      const quadrant = [0, 2, 3, 1][(y < half ? 0 : 2) + (x < half ? 0 : 1)] ?? 0;
      return (inner[y % half]?.[x % half] ?? 0) * 4 + quadrant;
    }),
  );
}

const DITHER_SIZE = 8;
/** Each dither cell's side, in CSS pixels. */
const DITHER_CELL = 2;
const DITHER_TILE = DITHER_SIZE * DITHER_CELL;

/** Each level's lit cells as one path: level n lights the n + 1 lowest-ranked cells. */
export const DITHER_LEVELS = (() => {
  const matrix = bayerMatrix(DITHER_SIZE);
  return Array.from({ length: DITHER_SIZE * DITHER_SIZE }, (_, level) => ({
    level,
    path: matrix
      .flatMap((row, y) =>
        row.map((rank, x) =>
          rank > level
            ? ""
            : `M${x * DITHER_CELL} ${y * DITHER_CELL}h${DITHER_CELL}v${DITHER_CELL}h-${DITHER_CELL}z`,
        ),
      )
      .join(""),
  }));
})();

/** Each span lays a colour and thickens the next over it one band per level, through one mask
    of white level patterns, so the geometry exists once however many colours. The bands are laid
    out in percentages, so they move with the fill's width as it follows the thumb. */
export function EffortDither(props: { readonly stops: EffortDitherStops }) {
  const id = `fork-effort-dither${useId().replaceAll(":", "")}`;
  const { stops } = props;
  const spans = stops.flatMap((under, span) => {
    const ink = stops[span + 1];
    return ink === undefined ? [] : [{ span, under, ink }];
  });
  const bands = spans.length * DITHER_LEVELS.length;
  const spanWidth = 100 / spans.length;
  return (
    <svg
      aria-hidden
      data-fork-effort-dither=""
      className="absolute inset-y-0 left-0 h-full w-[calc(100%-var(--fork-effort-thumb-width)/2)]"
      shapeRendering="crispEdges"
    >
      <defs>
        {DITHER_LEVELS.map(({ level, path }) => (
          <pattern
            key={level}
            id={`${id}-${level}`}
            width={DITHER_TILE}
            height={DITHER_TILE}
            patternUnits="userSpaceOnUse"
          >
            <path d={path} fill="white" />
          </pattern>
        ))}
        <mask id={`${id}-bands`} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
          {spans.flatMap(({ span }) =>
            DITHER_LEVELS.map(({ level }) => (
              <rect
                key={`${span}-${level}`}
                x={`${((span * DITHER_LEVELS.length + level) / bands) * 100}%`}
                width={`${100 / bands}%`}
                height="100%"
                fill={`url(#${id}-${level})`}
              />
            )),
          )}
        </mask>
      </defs>
      {spans.map(({ span, under, ink }) => (
        <g key={span}>
          <rect
            x={`${span * spanWidth}%`}
            width={`${spanWidth}%`}
            height="100%"
            style={{ fill: under }}
          />
          <rect
            x={`${span * spanWidth}%`}
            width={`${spanWidth}%`}
            height="100%"
            style={{ fill: ink }}
            mask={`url(#${id}-bands)`}
          />
        </g>
      ))}
    </svg>
  );
}
