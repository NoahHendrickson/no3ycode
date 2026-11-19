/**
 * Where Basic's new-agent dithers sit in the chat column — see
 * `.fork/customizations.yaml#fork-basic-theme`.
 */

/** assets/basic-new-agent-dither.png, one pixel per dither cell. */
export const DITHER_CELLS = { width: 864, height: 559 } as const;

/** The empty run between the two drapes at the headline's height, in cells from the left. */
const GAP = { from: 533, centre: 606 } as const;

/** The size the picture was drawn for: a MacBook screen at 2px a cell. */
const MIN_CELL_CSS_PX = 2;

export interface DitherLayout {
  /** One cell, in CSS px; always a whole number of device pixels. */
  readonly cell: number;
  /** The picture's left edge from the column's, in CSS px (zero or less). */
  readonly left: number;
}

/**
 * The smallest whole-device-pixel cell that reaches the column's foot and keeps the column's centre
 * inside the gap with the picture against the right edge. The picture centres its gap on the column
 * when that still covers the right edge, and otherwise sits against it.
 */
export function ditherLayout(box: { width: number; height: number }, dpr: number): DitherLayout {
  const devicePx = Math.max(
    Math.round(MIN_CELL_CSS_PX * dpr),
    Math.ceil((box.height * dpr) / DITHER_CELLS.height),
    Math.ceil((box.width * dpr) / (2 * (DITHER_CELLS.width - GAP.from))),
    1,
  );
  const cell = devicePx / dpr;
  const left = Math.max(box.width - DITHER_CELLS.width * cell, box.width / 2 - GAP.centre * cell);
  // Up, never down: a picture short of the right edge by a device pixel shows a seam.
  return { cell, left: Math.min(0, Math.ceil(left * dpr) / dpr) };
}

/** assets/basic-new-agent-mountain.png, one pixel per cell; opaque, so it covers the column. */
export const MOUNTAIN_CELLS = { width: 692, height: 447 } as const;

export interface MountainLayout extends DitherLayout {
  /** The picture's top edge from the column's, in CSS px (zero or less). */
  readonly top: number;
}

/** The smallest whole-device-pixel cell that covers the column, with the picture centred on it. */
export function mountainLayout(
  box: { width: number; height: number },
  dpr: number,
): MountainLayout {
  const devicePx = Math.max(
    Math.ceil((box.width * dpr) / MOUNTAIN_CELLS.width),
    Math.ceil((box.height * dpr) / MOUNTAIN_CELLS.height),
    1,
  );
  const cell = devicePx / dpr;
  // The nearest whole-device-pixel offset to centred that still covers both edges.
  const place = (column: number, picture: number) =>
    Math.min(
      0,
      Math.max(
        Math.ceil((column - picture) * dpr) / dpr,
        Math.round(((column - picture) / 2) * dpr) / dpr,
      ),
    );
  return {
    cell,
    left: place(box.width, MOUNTAIN_CELLS.width * cell),
    top: place(box.height, MOUNTAIN_CELLS.height * cell),
  };
}
