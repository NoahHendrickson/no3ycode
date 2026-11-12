import { useEffect, useRef, useState, type CSSProperties } from "react";

import { useMediaQuery } from "~/hooks/useMediaQuery";
import { observeResize } from "~/lib/observeResize";
import { cn } from "~/lib/utils";

import { paintPixelTexture, settleTexture } from "./paintPixelTexture";

const MASK = "linear-gradient(to right, transparent 0, #000 12%)";

/**
 * The portfolio's Landing texture, filling the box the caller places it in from its top
 * right. It animates for `settleMs` after mounting, then holds its last frame; under
 * reduced motion it draws one still frame.
 */
export function PixelTextureBackdrop({
  className,
  style,
  colors,
  label,
  settleMs = 2500,
}: {
  className?: string;
  style?: CSSProperties;
  /** Literal colours: `ground` is the surface behind it, cut into the tiles' glyphs. */
  colors: { ground: string; text: string };
  /** Without one the texture is decorative and hidden from assistive tech. */
  label?: string;
  settleMs?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settleAtRef = useRef<number | null>(null);
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

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- paints the canvas imperatively and owns its frame loop until the settle deadline
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || box.width === 0) return;
    const motion = settleTexture(settleAtRef.current, performance.now(), settleMs, reducedMotion);
    settleAtRef.current = motion.settleAt;
    return paintPixelTexture(canvas, box, { ground, text }, motion.animateUntil);
  }, [box, ground, text, settleMs, reducedMotion]);

  return (
    <div
      ref={wrapRef}
      className={cn("flex h-full w-full items-start justify-end", className)}
      style={{ maskImage: MASK, WebkitMaskImage: MASK, ...style }}
    >
      <canvas
        ref={canvasRef}
        className="shrink-0"
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
      />
    </div>
  );
}
