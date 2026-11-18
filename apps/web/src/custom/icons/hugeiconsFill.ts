/**
 * A filled weight derived from Hugeicons' free Stroke Rounded set, which ships outlines only.
 *
 * An icon is a list of SVG elements. The outermost closed shapes (closed paths, circles,
 * rects) become the filled body; every element drawn inside a body's bounds is cut out of
 * it through a mask, so interior detail still reads; elements outside every body (a bell's
 * clapper, a user's shoulders) keep their stroke. An icon with no closed shape (arrows,
 * chevrons, plus) has nothing to fill and comes back null, so callers draw the stroke.
 */

export type IconSvgAttributes = { readonly [key: string]: string | number };
export type IconSvgElement = ReadonlyArray<readonly [string, IconSvgAttributes]>;

export interface FilledIcon {
  readonly bodies: IconSvgElement;
  readonly knockouts: IconSvgElement;
  readonly loose: IconSvgElement;
}

interface Box {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

interface Part {
  readonly element: IconSvgElement[number];
  readonly box: Box | null;
  readonly closed: boolean;
}

const COMMAND = /[MmLlHhVvCcSsQqTtAaZz]/;
const TOKEN = /[MmLlHhVvCcSsQqTtAaZz]|-?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][-+]?\d+)?/g;
const ARITY: Record<string, number> = {
  m: 2,
  l: 2,
  h: 1,
  v: 1,
  c: 6,
  s: 4,
  q: 4,
  t: 2,
  a: 7,
  z: 0,
};

function num(value: string | number | undefined): number {
  return typeof value === "number" ? value : Number.parseFloat(value ?? "0") || 0;
}

/** Bounds over every end and control point (a safe superset), and whether every subpath closes. */
function measurePath(d: string): { box: Box | null; closed: boolean } {
  const tokens = d.match(TOKEN) ?? [];
  const xs: number[] = [];
  const ys: number[] = [];
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let subpaths = 0;
  let closedSubpaths = 0;
  let index = 0;
  let command = "";
  const add = (px: number, py: number) => {
    xs.push(px);
    ys.push(py);
  };
  while (index < tokens.length) {
    if (COMMAND.test(tokens[index]!)) command = tokens[index++]!;
    const lower = command.toLowerCase();
    const relative = command !== command.toUpperCase();
    if (lower === "z") {
      closedSubpaths += 1;
      x = startX;
      y = startY;
      continue;
    }
    const arity = ARITY[lower];
    if (arity === undefined || index + arity > tokens.length) break;
    const args = tokens.slice(index, index + arity).map(Number);
    index += arity;
    const ox = relative ? x : 0;
    const oy = relative ? y : 0;
    switch (lower) {
      case "h":
        x = args[0]! + (relative ? x : 0);
        break;
      case "v":
        y = args[0]! + (relative ? y : 0);
        break;
      case "a":
        x = args[5]! + ox;
        y = args[6]! + oy;
        break;
      default:
        for (let pair = 0; pair < arity - 2; pair += 2) add(args[pair]! + ox, args[pair + 1]! + oy);
        x = args[arity - 2]! + ox;
        y = args[arity - 1]! + oy;
    }
    add(x, y);
    if (lower === "m") {
      subpaths += 1;
      startX = x;
      startY = y;
      // Coordinates after an M are implicit L commands.
      command = relative ? "l" : "L";
    }
  }
  if (xs.length === 0) return { box: null, closed: false };
  return {
    box: {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    },
    closed: subpaths > 0 && closedSubpaths >= subpaths,
  };
}

/** A part some glyphs ship as its stroke already outlined: filled, unstroked line art. */
export function isOutlinedStroke(attrs: IconSvgAttributes): boolean {
  return attrs["fill"] !== undefined && attrs["fill"] !== "none" && attrs["stroke"] === undefined;
}

function measure(element: IconSvgElement[number]): Part {
  const part = measureShape(element);
  return isOutlinedStroke(element[1]) ? { ...part, closed: false } : part;
}

function measureShape(element: IconSvgElement[number]): Part {
  const [tag, attrs] = element;
  switch (tag) {
    case "path":
      return { element, ...measurePath(String(attrs["d"] ?? "")) };
    case "circle": {
      const r = num(attrs["r"]);
      const cx = num(attrs["cx"]);
      const cy = num(attrs["cy"]);
      return {
        element,
        box: { minX: cx - r, minY: cy - r, maxX: cx + r, maxY: cy + r },
        closed: true,
      };
    }
    case "ellipse": {
      const rx = num(attrs["rx"]);
      const ry = num(attrs["ry"]);
      const cx = num(attrs["cx"]);
      const cy = num(attrs["cy"]);
      return {
        element,
        box: { minX: cx - rx, minY: cy - ry, maxX: cx + rx, maxY: cy + ry },
        closed: true,
      };
    }
    case "rect": {
      const rx = num(attrs["x"]);
      const ry = num(attrs["y"]);
      return {
        element,
        box: {
          minX: rx,
          minY: ry,
          maxX: rx + num(attrs["width"]),
          maxY: ry + num(attrs["height"]),
        },
        closed: true,
      };
    }
    case "line":
      return {
        element,
        box: {
          minX: Math.min(num(attrs["x1"]), num(attrs["x2"])),
          minY: Math.min(num(attrs["y1"]), num(attrs["y2"])),
          maxX: Math.max(num(attrs["x1"]), num(attrs["x2"])),
          maxY: Math.max(num(attrs["y1"]), num(attrs["y2"])),
        },
        closed: false,
      };
    default:
      return { element, box: null, closed: false };
  }
}

const SLACK = 0.5;

function inside(inner: Box, outer: Box): boolean {
  return (
    inner.minX >= outer.minX - SLACK &&
    inner.minY >= outer.minY - SLACK &&
    inner.maxX <= outer.maxX + SLACK &&
    inner.maxY <= outer.maxY + SLACK
  );
}

const area = (box: Box) => (box.maxX - box.minX) * (box.maxY - box.minY);

const MIN_BODY_SHARE = 0.15;

function union(boxes: ReadonlyArray<Box>): Box | null {
  if (boxes.length === 0) return null;
  return {
    minX: Math.min(...boxes.map((box) => box.minX)),
    minY: Math.min(...boxes.map((box) => box.minY)),
    maxX: Math.max(...boxes.map((box) => box.maxX)),
    maxY: Math.max(...boxes.map((box) => box.maxY)),
  };
}

const cache = new WeakMap<IconSvgElement, FilledIcon | null>();

export function deriveFilledIcon(icon: IconSvgElement): FilledIcon | null {
  const cached = cache.get(icon);
  if (cached !== undefined) return cached;
  const parts = icon.map(measure);
  const closed = parts.filter(
    (part): part is Part & { box: Box } => part.closed && part.box !== null,
  );
  // A body is a closed shape no larger closed shape contains.
  const bodies = closed.filter(
    (part) =>
      !closed.some(
        (other) =>
          other !== part && area(other.box) > area(part.box) && inside(part.box, other.box),
      ),
  );
  // Filling only a minor part (a clipboard's clip over an open board) reads as a different icon.
  const extent = union(parts.flatMap((part) => (part.box ? [part.box] : [])));
  const largestBody = Math.max(0, ...bodies.map((body) => area(body.box)));
  let filled: FilledIcon | null = null;
  if (bodies.length > 0 && extent && largestBody >= MIN_BODY_SHARE * area(extent)) {
    const knockouts: Array<IconSvgElement[number]> = [];
    const loose: Array<IconSvgElement[number]> = [];
    for (const part of parts) {
      if (bodies.includes(part as Part & { box: Box })) continue;
      const within = part.box !== null && bodies.some((body) => inside(part.box as Box, body.box));
      (within ? knockouts : loose).push(part.element);
    }
    filled = { bodies: bodies.map((body) => body.element), knockouts, loose };
  }
  cache.set(icon, filled);
  return filled;
}
