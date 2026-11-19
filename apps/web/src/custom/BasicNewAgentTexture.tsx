/**
 * Basic's new-agent stage — see `.fork/customizations.yaml#fork-basic-theme`. Inlet Black's pixel
 * texture (custom/InletBlackNewAgentTexture), behind the draft on every Basic tone, inked in that
 * tone's colours, in from the column's right edge; or, picked in Settings › Appearance, the dither
 * picture across the whole column. A draft's header is empty (theme.custom.basic.css), so either
 * runs the column's full height.
 */
import ditherUrl from "./assets/basic-new-agent-dither.png";
import { useBasicNewAgentBackdrop } from "./basicNewAgentBackdrop";
import { BASIC_TONE_OPTIONS, useActiveBasicTone } from "./forkTheme";
import { PixelTextureBackdrop } from "./pixelTexture/PixelTextureBackdrop";

// The PNG is one pixel per dither cell, 864 x 559, drawn for a MacBook screen at 2px a cell.
// Every cell stays a whole number of pixels: at least 2, more only when the column is taller than
// the picture, so it never ends above the column's foot. Anchored top right, the column's centre
// falls in the gap between the two drapes, where the headline sits.
const DITHER_STYLE = {
  backgroundImage: `url(${ditherUrl})`,
  backgroundPosition: "right top",
  backgroundRepeat: "no-repeat",
  backgroundSize: "auto max(1118px, round(up, 100%, 559px))",
  imageRendering: "pixelated",
} as const;

export function BasicNewAgentTexture(props: { readonly shown: boolean }) {
  const tone = useActiveBasicTone();
  const [backdrop] = useBasicNewAgentBackdrop();
  if (!props.shown || tone === null) return null;
  if (backdrop === "dither") {
    return (
      <div aria-hidden className="pointer-events-none absolute inset-0" style={DITHER_STYLE} />
    );
  }
  return (
    <PixelTextureBackdrop
      colors={{ ground: BASIC_TONE_OPTIONS[tone].base, text: BASIC_TONE_OPTIONS[tone].text }}
      className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
    />
  );
}
