/**
 * Basic's new-agent stage — see `.fork/customizations.yaml#fork-basic-theme`: the tone-inked pixel
 * texture on the column's right half, the breathing dither across it, or the still Mountain Dither
 * covering it, as picked in Settings › Appearance.
 */
import { type RefObject, useEffect, useRef, useState } from "react";

import { useMediaQuery } from "~/hooks/useMediaQuery";
import { observeResize } from "~/lib/observeResize";

import ditherUrl from "./assets/basic-new-agent-dither.png";
import mountainUrl from "./assets/basic-new-agent-mountain.png";
import { useBasicNewAgentBackdrop } from "./basicNewAgentBackdropSetting";
import {
  DITHER_CELLS,
  MOUNTAIN_CELLS,
  ditherLayout,
  mountainLayout,
  type PictureLayout,
} from "./basicNewAgentDither";
import { runWhileFocused } from "./backgroundPausedLoop";
import { cellsFromRgba, createDitherLight } from "./ditherLight";
import { BASIC_TONE_OPTIONS, useActiveBasicTone } from "./forkTheme";
import { PixelTextureBackdrop } from "./pixelTexture/PixelTextureBackdrop";

export function BasicNewAgentBackdrop(props: { readonly shown: boolean }) {
  const tone = useActiveBasicTone();
  const [backdrop] = useBasicNewAgentBackdrop();
  if (!props.shown || tone === null) return null;
  if (backdrop === "dither") return <DitherBackdrop />;
  if (backdrop === "mountain") return <MountainBackdrop />;
  return (
    <PixelTextureBackdrop
      colors={{ ground: BASIC_TONE_OPTIONS[tone].base, text: BASIC_TONE_OPTIONS[tone].text }}
      className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
    />
  );
}

/** Lays a picture out for the box `ref` measures, again whenever the box resizes. */
function useColumnLayout(
  ref: RefObject<HTMLDivElement | null>,
  layoutFor: (box: { width: number; height: number }, dpr: number) => PictureLayout,
): PictureLayout | null {
  const [layout, setLayout] = useState<PictureLayout | null>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- measures the column's DOM box and the display's pixel ratio
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return observeResize(el, () => {
      // Fractional, unlike clientWidth: a rounded-down size leaves a device pixel uncovered.
      const { width, height } = el.getBoundingClientRect();
      if (width === 0) return;
      const next = layoutFor({ width, height }, window.devicePixelRatio || 1);
      setLayout((prev) =>
        prev?.cell === next.cell && prev.left === next.left && prev.top === next.top ? prev : next,
      );
    });
  }, [ref, layoutFor]);
  return layout;
}

function MountainBackdrop() {
  const ref = useRef<HTMLDivElement>(null);
  const layout = useColumnLayout(ref, mountainLayout);
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 bg-no-repeat [image-rendering:pixelated]"
      style={
        layout
          ? {
              backgroundImage: `url(${mountainUrl})`,
              backgroundSize: `${MOUNTAIN_CELLS.width * layout.cell}px ${MOUNTAIN_CELLS.height * layout.cell}px`,
              backgroundPosition: `${layout.left}px ${layout.top}px`,
            }
          : undefined
      }
    />
  );
}

/** Like real rays: full strength where the light comes in at the top, faint by the column's foot. */
const RAYS_FADE =
  "linear-gradient(to bottom, #000 0%, rgb(0 0 0 / 0.7) 35%, rgb(0 0 0 / 0.2) 100%)";

function DitherBackdrop() {
  const ref = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const layout = useColumnLayout(ref, ditherLayout);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- paints the canvas imperatively and owns its frame loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return paintDither(canvas, !reducedMotion);
  }, [reducedMotion]);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ maskImage: RAYS_FADE, WebkitMaskImage: RAYS_FADE }}
    >
      <canvas
        ref={canvasRef}
        width={DITHER_CELLS.width}
        height={DITHER_CELLS.height}
        className="absolute top-0 [image-rendering:pixelated]"
        style={
          layout
            ? {
                left: layout.left,
                width: DITHER_CELLS.width * layout.cell,
                height: DITHER_CELLS.height * layout.cell,
              }
            : { visibility: "hidden" }
        }
      />
    </div>
  );
}

/** The light moves slowly and in whole cells, so ten frames a second reads as smooth. */
const FRAME_GAP_MS = 100;

/** Draws the picture one canvas pixel per cell and, when `animate`, keeps its streaks breathing. */
function paintDither(canvas: HTMLCanvasElement, animate: boolean): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const { width, height } = DITHER_CELLS;
  let cancelled = false;
  let stop = () => {};

  const image = new Image();
  image.src = ditherUrl;
  void image.decode().then(
    () => {
      if (cancelled) return;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0);
      if (!animate) return;
      const pixels = ctx.getImageData(0, 0, width, height);
      const light = createDitherLight(cellsFromRgba(pixels.data), width, height);
      stop = runWhileFocused(FRAME_GAP_MS, (elapsedMs) => {
        const dirty = light.step(elapsedMs / 1000, pixels.data);
        if (dirty) ctx.putImageData(pixels, 0, 0, dirty.x, dirty.y, dirty.width, dirty.height);
      });
    },
    () => {
      // The asset failed to load: nothing is drawn, as with the texture's own failures.
    },
  );

  return () => {
    cancelled = true;
    stop();
  };
}
