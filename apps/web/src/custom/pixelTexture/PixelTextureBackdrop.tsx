import { useEffect, useRef, useState } from "react";

import { useMediaQuery } from "~/hooks/useMediaQuery";
import { observeResize } from "~/lib/observeResize";
import { cn } from "~/lib/utils";

import { paintPixelTexture, textureGrid } from "./paintPixelTexture";

const MASK = "linear-gradient(to right, transparent 0, #000 12%)";

/**
 * The portfolio's Landing texture, filling the box the caller places it in from its top
 * right. It keeps moving while mounted; under reduced motion it draws one still frame.
 * Decorative, so hidden from assistive tech.
 */
export function PixelTextureBackdrop({
  className,
  colors,
}: {
  className?: string;
  /** Literal colours: `ground` is the surface behind it, cut into the tiles' glyphs. */
  colors: { ground: string; text: string };
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [box, setBox] = useState({ width: 0, height: 0 });
  const { ground, text } = colors;

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- measures the wrapper's DOM box, which the caller's layout sizes
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    return observeResize(wrap, () => {
      const width = wrap.clientWidth;
      const height = wrap.clientHeight;
      setBox((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    });
  }, []);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- paints the canvas imperatively and owns its frame loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || box.width === 0) return;
    const grid = textureGrid(box, window.devicePixelRatio || 1);
    return paintPixelTexture(canvas, grid, { ground, text }, !reducedMotion);
  }, [box, ground, text, reducedMotion]);

  return (
    <div
      ref={wrapRef}
      className={cn("flex h-full w-full items-start justify-end", className)}
      style={{ maskImage: MASK, WebkitMaskImage: MASK }}
    >
      <canvas ref={canvasRef} className="shrink-0" aria-hidden />
    </div>
  );
}
