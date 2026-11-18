// Hugeicons glyphs ready to draw. Their shared stroke moves to the <svg>, so a caller's stroke
// props reach it. The free set lacks a filled weight, so it is derived: closed contours no larger
// contour contains fill, detail wholly inside is masked out, parts reaching outside stay stroked.
// A glyph with nothing (or only a minor piece) to fill, or unmeasurable geometry, stays stroked.

type Attributes = { readonly [key: string]: string | number };
export type IconSvgElement = ReadonlyArray<readonly [string, Attributes]>;
type Element = IconSvgElement[number];
type Point = readonly [number, number];

export const GLYPH_STROKE = {
  stroke: "currentColor",
  strokeWidth: "1.5",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export interface GlyphDrawing {
  /** Filled bodies; drawn through the mask when there are knockouts. */
  readonly bodies: IconSvgElement;
  /** Mask content, already black so it cuts out of the bodies. */
  readonly knockouts: IconSvgElement;
  /** Drawn as they are, after the bodies. */
  readonly plain: IconSvgElement;
}

/** At 12px a 1.5-unit cut is under a pixel, so cuts are at least 2 units wide. */
const KNOCKOUT_WIDTH = 2;
/** A filled body smaller than this share of the glyph's extent reads as a different icon. */
const MIN_BODY_SHARE = 0.15;
/** Half a stroke: a detail touching a body's outline still counts as inside it. */
const EDGE_TOLERANCE = 0.75;

type Matrix = readonly [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** matrix(), translate() and scale() lists; null for anything else (the glyph stays stroked). */
function parseTransform(value: string | number | undefined): Matrix | null {
  if (value === undefined) return IDENTITY;
  let result: Matrix = IDENTITY;
  for (const [, name, args] of String(value).matchAll(/(\w+)\(([^)]*)\)/g)) {
    const n = (args ?? "")
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    let next: Matrix;
    if (name === "matrix" && n.length === 6) next = [n[0]!, n[1]!, n[2]!, n[3]!, n[4]!, n[5]!];
    else if (name === "translate") next = [1, 0, 0, 1, n[0] ?? 0, n[1] ?? 0];
    else if (name === "scale") next = [n[0] ?? 1, 0, 0, n[1] ?? n[0] ?? 1, 0, 0];
    else return null;
    const [a, b, c, d, e, f] = result;
    result = [
      a * next[0] + c * next[1],
      b * next[0] + d * next[1],
      a * next[2] + c * next[3],
      b * next[2] + d * next[3],
      a * next[4] + c * next[5] + e,
      b * next[4] + d * next[5] + f,
    ];
  }
  return result;
}

const apply = ([a, b, c, d, e, f]: Matrix, [x, y]: Point): Point => [
  a * x + c * y + e,
  b * x + d * y + f,
];

const num = (value: string | number | undefined) =>
  typeof value === "number" ? value : Number.parseFloat(value ?? "0") || 0;

function ring(cx: number, cy: number, rx: number, ry: number): Point[] {
  return Array.from({ length: 24 }, (_, i): Point => {
    const angle = (i / 24) * Math.PI * 2;
    return [cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)];
  });
}

const COMMAND = /^[MmLlHhVvCcSsQqTtAaZz]$/;
const TOKEN = /[MmLlHhVvCcSsQqTtAaZz]|-?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][-+]?\d+)?/g;
const ARITY: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7 };
const SAMPLES = [0.25, 0.5, 0.75, 1] as const;

interface Subpath {
  /** The subpath as path data that stands on its own. */
  readonly d: string;
  readonly closed: boolean;
  /** Points along the outline, in order. */
  readonly points: ReadonlyArray<Point>;
}

function cubic(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;
  return [
    w[0] * p0[0] + w[1] * p1[0] + w[2] * p2[0] + w[3] * p3[0],
    w[0] * p0[1] + w[1] * p1[1] + w[2] * p2[1] + w[3] * p3[1],
  ];
}

/** A quadratic as the cubic it equals, sampled. */
function quadratic(from: Point, control: Point, to: Point): Point[] {
  const c1: Point = [
    from[0] + (2 / 3) * (control[0] - from[0]),
    from[1] + (2 / 3) * (control[1] - from[1]),
  ];
  const c2: Point = [
    to[0] + (2 / 3) * (control[0] - to[0]),
    to[1] + (2 / 3) * (control[1] - to[1]),
  ];
  return SAMPLES.map((t) => cubic(from, c1, c2, to, t));
}

interface Building {
  tokens: string[];
  points: Point[];
  closed: boolean;
}

/** Splits path data into subpaths, sampling each along its outline. */
function subpaths(d: string): Subpath[] {
  const tokens = d.match(TOKEN) ?? [];
  const result: Subpath[] = [];
  let current: Building | null = null;
  let point: Point = [0, 0];
  let start: Point = [0, 0];
  let lastControl: Point | null = null;
  let lastQuad: Point | null = null;
  let command = "";
  let index = 0;
  const finish = () => {
    if (current && current.points.length > 0) {
      result.push({ d: current.tokens.join(" "), closed: current.closed, points: current.points });
    }
    current = null;
  };
  const open = (at: Point): Building => ({
    tokens: ["M", String(at[0]), String(at[1])],
    points: [at],
    closed: false,
  });
  while (index < tokens.length) {
    const token = tokens[index]!;
    if (COMMAND.test(token)) {
      command = token;
      index += 1;
    } else if (command === "" || command.toLowerCase() === "z") {
      // A number with no command to take it is malformed; stop rather than spin.
      break;
    }
    const lower = command.toLowerCase();
    const relative = command !== command.toUpperCase();
    if (lower === "z") {
      if (current) {
        current.tokens.push("Z");
        current.closed = true;
      }
      point = start;
      lastControl = null;
      lastQuad = null;
      continue;
    }
    const arity = ARITY[lower];
    if (arity === undefined || index + arity > tokens.length) break;
    const raw = tokens.slice(index, index + arity);
    const args = raw.map(Number);
    index += arity;
    const at = (x: number, y: number): Point => (relative ? [point[0] + x, point[1] + y] : [x, y]);
    if (lower === "m") {
      finish();
      point = at(args[0]!, args[1]!);
      start = point;
      // Absolute, so the subpath stands on its own; later pairs are line-tos of the same kind.
      current = open(point);
      command = relative ? "l" : "L";
      lastControl = null;
      lastQuad = null;
      continue;
    }
    const building: Building = current ?? open(point);
    current = building;
    building.tokens.push(command, ...raw);
    const from = point;
    let control: Point | null = null;
    let quad: Point | null = null;
    switch (lower) {
      case "l":
        point = at(args[0]!, args[1]!);
        building.points.push(point);
        break;
      case "h":
        point = [relative ? point[0] + args[0]! : args[0]!, point[1]];
        building.points.push(point);
        break;
      case "v":
        point = [point[0], relative ? point[1] + args[0]! : args[0]!];
        building.points.push(point);
        break;
      case "c":
      case "s": {
        const c1: Point =
          lower === "c"
            ? at(args[0]!, args[1]!)
            : lastControl
              ? [2 * from[0] - lastControl[0], 2 * from[1] - lastControl[1]]
              : from;
        const c2 = lower === "c" ? at(args[2]!, args[3]!) : at(args[0]!, args[1]!);
        const to = lower === "c" ? at(args[4]!, args[5]!) : at(args[2]!, args[3]!);
        for (const t of SAMPLES) building.points.push(cubic(from, c1, c2, to, t));
        control = c2;
        point = to;
        break;
      }
      case "q":
      case "t": {
        quad =
          lower === "q"
            ? at(args[0]!, args[1]!)
            : lastQuad
              ? [2 * from[0] - lastQuad[0], 2 * from[1] - lastQuad[1]]
              : from;
        const to = lower === "q" ? at(args[2]!, args[3]!) : at(args[0]!, args[1]!);
        building.points.push(...quadratic(from, quad, to));
        point = to;
        break;
      }
      case "a": {
        // Arcs are sampled as their chord, which under-measures their bulge.
        const to = at(args[5]!, args[6]!);
        building.points.push([(from[0] + to[0]) / 2, (from[1] + to[1]) / 2], to);
        point = to;
        break;
      }
    }
    lastControl = control;
    lastQuad = quad;
  }
  finish();
  return result;
}

interface Shape {
  readonly element: Element;
  /** Closed and painted by its stroke: a candidate body. */
  readonly closed: boolean;
  /** Filled and unstroked: a stroke some glyphs ship already outlined. */
  readonly outlined: boolean;
  readonly points: ReadonlyArray<Point>;
  readonly area: number;
}

function polygonArea(points: ReadonlyArray<Point>): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i]!;
    const [x2, y2] = points[(i + 1) % points.length]!;
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

function boxArea(points: ReadonlyArray<Point>): number {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
}

/** The glyph's shapes, one per contour, or null when one can't be measured. */
function shapes(icon: IconSvgElement): Shape[] | null {
  const result: Shape[] = [];
  for (const element of icon) {
    const [tag, attrs] = element;
    const matrix = parseTransform(attrs["transform"]);
    if (!matrix) return null;
    const outlined =
      attrs["fill"] !== undefined && attrs["fill"] !== "none" && attrs["stroke"] === undefined;
    const push = (part: Element, points: ReadonlyArray<Point>, closed: boolean) => {
      const placed = points.map((p) => apply(matrix, p));
      result.push({
        element: part,
        closed: closed && !outlined,
        outlined,
        points: placed,
        area: closed ? polygonArea(placed) : 0,
      });
    };
    switch (tag) {
      case "path": {
        const parts = subpaths(String(attrs["d"] ?? ""));
        if (parts.length === 1) push(element, parts[0]!.points, parts[0]!.closed);
        for (const [i, part] of parts.length > 1 ? parts.entries() : []) {
          const key = `${String(attrs["key"] ?? "p")}-${i}`;
          push(["path", { ...attrs, d: part.d, key }], part.points, part.closed);
        }
        break;
      }
      case "circle": {
        const r = num(attrs["r"]);
        push(element, ring(num(attrs["cx"]), num(attrs["cy"]), r, r), true);
        break;
      }
      case "ellipse":
        push(
          element,
          ring(num(attrs["cx"]), num(attrs["cy"]), num(attrs["rx"]), num(attrs["ry"])),
          true,
        );
        break;
      case "rect": {
        const [x, y, w, h] = [attrs["x"], attrs["y"], attrs["width"], attrs["height"]].map(num);
        push(
          element,
          [
            [x!, y!],
            [x! + w!, y!],
            [x! + w!, y! + h!],
            [x!, y! + h!],
          ],
          true,
        );
        break;
      }
      case "line":
        push(
          element,
          [
            [num(attrs["x1"]), num(attrs["y1"])],
            [num(attrs["x2"]), num(attrs["y2"])],
          ],
          false,
        );
        break;
      default:
        return null;
    }
  }
  return result;
}

function distanceToSegment([px, py]: Point, [ax, ay]: Point, [bx, by]: Point): number {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function insidePolygon(point: Point, polygon: ReadonlyArray<Point>): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!;
    const [xj, yj] = polygon[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return (
    inside ||
    polygon.some(
      (corner, i) =>
        distanceToSegment(point, corner, polygon[(i + 1) % polygon.length]!) <= EDGE_TOLERANCE,
    )
  );
}

const within = (part: Shape, body: Shape) =>
  part.points.every((point) => insidePolygon(point, body.points));

/** Drops the attributes GLYPH_STROKE already sets on the <svg>; a fill-only part opts out of it. */
function hoisted([tag, attrs]: Element): Element {
  const rest: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(attrs)) {
    const shared = (GLYPH_STROKE as Record<string, string>)[name];
    if (shared !== undefined && String(value) === shared) continue;
    rest[name] = value;
  }
  if (attrs["stroke"] === undefined) rest["stroke"] = "none";
  return [tag, rest];
}

function deriveFill(icon: IconSvgElement): GlyphDrawing | null {
  const all = shapes(icon);
  if (!all || all.length === 0) return null;
  const closed = all.filter((shape) => shape.closed);
  const bodies = new Set(
    closed.filter(
      (shape) =>
        !closed.some((other) => other !== shape && other.area > shape.area && within(shape, other)),
    ),
  );
  const largest = Math.max(0, ...[...bodies].map((body) => boxArea(body.points)));
  const extent = boxArea(all.flatMap((shape) => shape.points));
  if (bodies.size === 0 || largest < MIN_BODY_SHARE * extent) return null;
  const knockouts: Element[] = [];
  const plain: Element[] = [];
  for (const shape of all) {
    if (bodies.has(shape)) continue;
    const [tag, attrs] = hoisted(shape.element);
    if (![...bodies].some((body) => within(shape, body))) plain.push([tag, attrs]);
    else if (shape.outlined) knockouts.push([tag, { ...attrs, fill: "black" }]);
    else
      knockouts.push([
        tag,
        { ...attrs, stroke: "black", fill: "none", strokeWidth: KNOCKOUT_WIDTH },
      ]);
  }
  const filledBodies = [...bodies].map((body): Element => {
    const [tag, attrs] = hoisted(body.element);
    return [tag, { ...attrs, fill: "currentColor" }];
  });
  return { bodies: filledBodies, knockouts, plain };
}

const strokeCache = new WeakMap<IconSvgElement, GlyphDrawing>();
const fillCache = new WeakMap<IconSvgElement, GlyphDrawing | null>();

function strokeDrawing(icon: IconSvgElement): GlyphDrawing {
  const cached = strokeCache.get(icon);
  if (cached) return cached;
  const drawing: GlyphDrawing = { bodies: [], knockouts: [], plain: icon.map(hoisted) };
  strokeCache.set(icon, drawing);
  return drawing;
}

function fillDrawing(icon: IconSvgElement): GlyphDrawing | null {
  if (!fillCache.has(icon)) fillCache.set(icon, deriveFill(icon));
  return fillCache.get(icon) ?? null;
}

/** Whether the glyph has a filled weight at all. */
export function canFill(icon: IconSvgElement): boolean {
  return fillDrawing(icon) !== null;
}

/** The glyph ready to draw: filled when asked and derivable, stroked otherwise. */
export function glyphDrawing(icon: IconSvgElement, filled: boolean): GlyphDrawing {
  return (filled ? fillDrawing(icon) : null) ?? strokeDrawing(icon);
}
