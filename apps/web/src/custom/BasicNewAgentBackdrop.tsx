/**
 * Basic's new-agent stage — see `.fork/customizations.yaml#fork-basic-theme`. Inlet Black's pixel
 * texture (custom/InletBlackNewAgentTexture), behind the draft on every Basic tone, inked in that
 * tone's colours, in from the column's right edge; or, picked in Settings › Appearance, the dither
 * picture across the whole column (basicNewAgentDither), with a slow light drifting over its
 * drapes (ditherLight), or the still Mountain Dither covering it. A draft's header is empty
 * (theme.custom.basic.css), so each runs the column's full height.
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
  type DitherLayout,
} from "./basicNewAgentDither";
import { DITHER_EMPTY, DITHER_PALETTE, createDitherLight } from "./ditherLight";
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
function useColumnLayout<T extends DitherLayout & { readonly top?: number }>(
  ref: RefObject<HTMLDivElement | null>,
  layoutFor: (box: { width: number; height: number }, dpr: number) => T,
): T | null {
  const [layout, setLayout] = useState<T | null>(null);
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

/** Draws the picture one canvas pixel per cell and, when `animate`, keeps the light moving. */
function paintDither(canvas: HTMLCanvasElement, animate: boolean): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const { width, height } = DITHER_CELLS;
  let cancelled = false;
  let frame = 0;
  let timer = 0;
  let stopListening = () => {};

  const image = new Image();
  image.src = ditherUrl;
  void image.decode().then(
    () => {
      if (cancelled) return;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0);
      if (!animate) return;
      const pixels = ctx.getImageData(0, 0, width, height);
      const data = pixels.data;
      const cells = new Uint8Array(width * height);
      for (let i = 0; i < cells.length; i++) {
        const o = i * 4;
        const match = DITHER_PALETTE.findIndex(
          ([r, g, b]) => data[o] === r && data[o + 1] === g && data[o + 2] === b,
        );
        cells[i] = data[o + 3] === 0 || match < 0 ? DITHER_EMPTY : match;
      }
      const light = createDitherLight(cells, width, height);

      const start = performance.now();
      // Time spent paused in the background, taken off the clock so the light doesn't jump.
      let pausedFor = 0;
      let pausedAt: number | null = null;
      const tick = (time: number) => {
        let x0: number = width;
        let y0: number = height;
        let x1 = -1;
        let y1 = -1;
        light.step((time - start - pausedFor) / 1000, (cell, colour) => {
          const x = cell % width;
          const y = (cell - x) / width;
          const rgb = colour === DITHER_EMPTY ? null : DITHER_PALETTE[colour];
          data.set(rgb ? [rgb[0], rgb[1], rgb[2], 255] : [0, 0, 0, 0], cell * 4);
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        });
        if (x1 >= 0) ctx.putImageData(pixels, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
        timer = window.setTimeout(() => {
          frame = requestAnimationFrame(tick);
        }, FRAME_GAP_MS);
      };
      // Holds while the window is in the background, as the pixel texture does.
      const pause = () => {
        if (pausedAt !== null) return;
        pausedAt = performance.now();
        cancelAnimationFrame(frame);
        window.clearTimeout(timer);
      };
      const resume = () => {
        if (pausedAt === null) return;
        pausedFor += performance.now() - pausedAt;
        pausedAt = null;
        frame = requestAnimationFrame(tick);
      };
      window.addEventListener("blur", pause);
      window.addEventListener("focus", resume);
      stopListening = () => {
        window.removeEventListener("blur", pause);
        window.removeEventListener("focus", resume);
      };
      if (document.hasFocus()) frame = requestAnimationFrame(tick);
      else pausedAt = performance.now();
    },
    () => {
      // Unmounted mid-load or the asset failed: nothing is drawn, as with the texture's own failures.
    },
  );

  return () => {
    cancelled = true;
    cancelAnimationFrame(frame);
    window.clearTimeout(timer);
    stopListening();
  };
}
