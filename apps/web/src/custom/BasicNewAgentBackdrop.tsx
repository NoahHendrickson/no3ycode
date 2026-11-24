/**
 * The new-agent stage under Basic, Glass and Inlet — see `.fork/customizations.yaml#fork-basic-theme`: the
 * pixel texture on the column's right half, the breathing dither across it, or a still picture
 * (Mountain Dither, Jolly Petal) covering it, as picked in Settings › Appearance. Glass's own
 * portrait is its stylesheet's (fork-glass-new-agent-stage), so nothing is drawn here for it.
 */
import { type RefObject, useEffect, useRef, useState } from "react";

import { useMediaQuery } from "~/hooks/useMediaQuery";
import { observeResize } from "~/lib/observeResize";

import ditherUrl from "./assets/basic-new-agent-dither.png";
import jollyPetalUrl from "./assets/basic-new-agent-jolly-petal.png";
import mountainUrl from "./assets/basic-new-agent-mountain.png";
import {
  type BasicNewAgentBackdrop as Backdrop,
  useBasicNewAgentBackdrop,
} from "./basicNewAgentBackdropSetting";
import {
  DITHER_CELLS,
  JOLLY_PETAL_CELLS,
  MOUNTAIN_CELLS,
  ditherLayout,
  jollyPetalLayout,
  mountainLayout,
  type PictureLayout,
} from "./basicNewAgentDither";
import { runWhileFocused } from "./backgroundPausedLoop";
import { cellsFromRgba, createDitherLight } from "./ditherLight";
import { useActiveForkPalette } from "./forkActivePalette";
import { useForkDraftLiquidGlass } from "./forkDraftLiquidGlass";
import { useGlassNewAgentBackdrop } from "./forkGlassNewAgentPicture";
import {
  BASIC_OPTIONS,
  COOL_DARKER_BACKGROUND,
  COOL_DARKER_THEME,
  INLET_BACKGROUND,
  INLET_COLOR_OPTIONS,
  type InletColor,
  useActiveBasicAppearance,
  useActiveInletColor,
} from "./forkTheme";
import { useInletNewAgentBackdrop } from "./inletNewAgentBackdropSetting";
import { PixelTextureBackdrop } from "./pixelTexture/PixelTextureBackdrop";

/** Glass's stage and ink (theme.custom.palettes.css), for the texture's tiles. */
const GLASS_TEXTURE_COLORS = { ground: COOL_DARKER_BACKGROUND, text: "#e8e8e8" };

/** Each Inlet colour's panel (the other colour's frame) and ink (theme.custom.palettes.css). */
const INLET_TEXTURE_COLORS: Record<InletColor, { ground: string; text: string }> = {
  black: { ground: INLET_BACKGROUND, text: "#1c1c1a" },
  cream: { ground: INLET_COLOR_OPTIONS.black.frame, text: "#e8e8e8" },
};

export function BasicNewAgentBackdrop(props: { readonly shown: boolean }) {
  const basicAppearance = useActiveBasicAppearance();
  const glass = useActiveForkPalette() === COOL_DARKER_THEME;
  const [basicBackdrop] = useBasicNewAgentBackdrop();
  const [glassBackdrop] = useGlassNewAgentBackdrop();
  const inletColor = useActiveInletColor();
  const [inletBackdrop] = useInletNewAgentBackdrop(inletColor ?? "black");
  if (!props.shown) return null;
  if (basicAppearance !== null) {
    const { base, text } = BASIC_OPTIONS[basicAppearance];
    return <Picture backdrop={basicBackdrop} textureColors={{ ground: base, text }} />;
  }
  if (glass && glassBackdrop !== "portrait") {
    return <Picture backdrop={glassBackdrop} textureColors={GLASS_TEXTURE_COLORS} />;
  }
  if (inletColor !== null && inletBackdrop !== "none") {
    return <Picture backdrop={inletBackdrop} textureColors={INLET_TEXTURE_COLORS[inletColor]} />;
  }
  return null;
}

function Picture(props: {
  readonly backdrop: Backdrop;
  readonly textureColors: { ground: string; text: string };
}) {
  const { backdrop } = props;
  if (backdrop === "dither") return <DitherBackdrop />;
  if (backdrop === "mountain") {
    return <StillBackdrop url={mountainUrl} cells={MOUNTAIN_CELLS} layoutFor={mountainLayout} />;
  }
  if (backdrop === "jollyPetal") {
    return (
      <StillBackdrop url={jollyPetalUrl} cells={JOLLY_PETAL_CELLS} layoutFor={jollyPetalLayout} />
    );
  }
  return (
    <PixelTextureBackdrop
      colors={props.textureColors}
      className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
    />
  );
}

/** Lays a picture out for the box `ref` measures, again whenever the box resizes. */
function useColumnLayout(
  ref: RefObject<HTMLDivElement | null>,
  layoutFor: LayoutFor,
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

type LayoutFor = (box: { width: number; height: number }, dpr: number) => PictureLayout;

function StillBackdrop(props: {
  readonly url: string;
  readonly cells: { readonly width: number; readonly height: number };
  readonly layoutFor: LayoutFor;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const layout = useColumnLayout(ref, props.layoutFor);
  useForkDraftLiquidGlass({ ref, url: props.url, cells: props.cells, layoutFor: props.layoutFor });
  return (
    <div
      ref={ref}
      aria-hidden
      // Covers the column opaquely, so Glass may blur it (theme.custom.palettes.css).
      data-fork-new-agent-backdrop=""
      data-fork-opaque-backdrop=""
      className="pointer-events-none absolute inset-0 bg-no-repeat [image-rendering:pixelated]"
      style={
        layout
          ? {
              backgroundImage: `url(${props.url})`,
              backgroundSize: `${props.cells.width * layout.cell}px ${props.cells.height * layout.cell}px`,
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
      data-fork-new-agent-backdrop=""
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
