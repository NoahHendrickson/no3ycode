import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

// Redlines for spec pages. The specimen renders magnified; every number is read from the live
// layout (offset sizes and computed styles, which transforms do not touch), never typed in.

const INK = "#ff3b6b";

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Measure {
  /** Where the part sits in the magnified frame, for drawing. */
  readonly box: Box;
  /** Its unscaled CSS size, for labels. */
  readonly width: number;
  readonly height: number;
  readonly style: CSSStyleDeclaration;
}

export function measureWithin(frame: Element, part: HTMLElement): Measure {
  const base = frame.getBoundingClientRect();
  const rect = part.getBoundingClientRect();
  return {
    box: { x: rect.left - base.left, y: rect.top - base.top, w: rect.width, h: rect.height },
    width: part.offsetWidth,
    height: part.offsetHeight,
    style: getComputedStyle(part),
  };
}

function Label({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <span
      className="absolute -translate-x-1/2 -translate-y-1/2 rounded px-1 font-mono text-[11px] leading-4 font-medium whitespace-nowrap text-white"
      style={{ left: x, top: y, background: INK }}
    >
      {children}
    </span>
  );
}

/** A dimension line with end ticks along `axis`, labelled at its middle. */
export function Dimension({
  axis,
  from,
  to,
  at,
  label,
}: {
  axis: "x" | "y";
  from: number;
  to: number;
  /** The line's position across the axis (y for a horizontal line, x for a vertical one). */
  at: number;
  label: ReactNode;
}) {
  const length = to - from;
  const mid = from + length / 2;
  const horizontal = axis === "x";
  return (
    <>
      <span
        className="absolute"
        style={
          horizontal
            ? { left: from, top: at, width: length, height: 1, background: INK }
            : { left: at, top: from, width: 1, height: length, background: INK }
        }
      />
      {[from, to].map((end) => (
        <span
          key={end}
          className="absolute"
          style={
            horizontal
              ? { left: end, top: at - 4, width: 1, height: 9, background: INK }
              : { left: at - 4, top: end, width: 9, height: 1, background: INK }
          }
        />
      ))}
      <Label x={horizontal ? mid : at} y={horizontal ? at : mid}>
        {label}
      </Label>
    </>
  );
}

/** Renders `children` magnified inside a frame, then hands `annotate` the frame to measure.
    Pass a module-level `annotate`: it is an effect dependency. */
export function Specimen({
  scale = 3,
  width,
  height,
  children,
  annotate,
}: {
  scale?: number;
  width: number;
  height: number;
  children: ReactNode;
  annotate: (frame: HTMLElement) => ReactNode;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [notes, setNotes] = useState<ReactNode>(null);
  useLayoutEffect(() => {
    const element = frame.current;
    if (!element) return;
    setNotes(annotate(element));
    // Text widths settle once the webfont loads.
    let live = true;
    void document.fonts.ready.then(() => {
      if (live) setNotes(annotate(element));
    });
    return () => {
      live = false;
    };
  }, [annotate]);
  return (
    <div ref={frame} className="relative" style={{ width, height }}>
      <div
        className="absolute"
        style={{ left: 56, top: 48, transform: `scale(${scale})`, transformOrigin: "top left" }}
      >
        {children}
      </div>
      {notes}
    </div>
  );
}
