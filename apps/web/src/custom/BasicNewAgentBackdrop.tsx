/**
 * Basic's new-agent stage — see `.fork/customizations.yaml#fork-basic-theme`. Inlet Black's pixel
 * texture (custom/InletBlackNewAgentTexture), behind the draft on every Basic tone, inked in that
 * tone's colours, in from the column's right edge; or, picked in Settings › Appearance, the dither
 * picture across the whole column (basicNewAgentDither). A draft's header is empty
 * (theme.custom.basic.css), so either runs the column's full height.
 */
import { useEffect, useRef, useState } from "react";

import { observeResize } from "~/lib/observeResize";

import ditherUrl from "./assets/basic-new-agent-dither.png";
import { useBasicNewAgentBackdrop } from "./basicNewAgentBackdropSetting";
import { DITHER_CELLS, ditherLayout, type DitherLayout } from "./basicNewAgentDither";
import { BASIC_TONE_OPTIONS, useActiveBasicTone } from "./forkTheme";
import { PixelTextureBackdrop } from "./pixelTexture/PixelTextureBackdrop";

export function BasicNewAgentBackdrop(props: { readonly shown: boolean }) {
  const tone = useActiveBasicTone();
  const [backdrop] = useBasicNewAgentBackdrop();
  if (!props.shown || tone === null) return null;
  if (backdrop === "dither") return <DitherBackdrop />;
  return (
    <PixelTextureBackdrop
      colors={{ ground: BASIC_TONE_OPTIONS[tone].base, text: BASIC_TONE_OPTIONS[tone].text }}
      className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
    />
  );
}

function DitherBackdrop() {
  const ref = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<DitherLayout | null>(null);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- measures the column's DOM box and the display's pixel ratio
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return observeResize(el, () => {
      if (el.clientWidth === 0) return;
      const next = ditherLayout(
        { width: el.clientWidth, height: el.clientHeight },
        window.devicePixelRatio || 1,
      );
      setLayout((prev) => (prev?.cell === next.cell && prev.left === next.left ? prev : next));
    });
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 bg-no-repeat [image-rendering:pixelated]"
      style={
        layout
          ? {
              backgroundImage: `url(${ditherUrl})`,
              backgroundSize: `${DITHER_CELLS.width * layout.cell}px ${DITHER_CELLS.height * layout.cell}px`,
              backgroundPosition: `${layout.left}px 0`,
            }
          : undefined
      }
    />
  );
}
