/**
 * Basic's new-agent stage — see `.fork/customizations.yaml#fork-basic-theme`. Inlet Black's pixel
 * texture (custom/InletBlackNewAgentTexture), behind the draft on every Basic tone, inked in that
 * tone's colours, in from the column's right edge. A draft's header is empty (theme.custom.basic.css),
 * so the texture runs the column's full height.
 */
import { BASIC_TONE_OPTIONS, useActiveBasicTone } from "./forkTheme";
import { PixelTextureBackdrop } from "./pixelTexture/PixelTextureBackdrop";

export function BasicNewAgentTexture(props: { readonly shown: boolean }) {
  const tone = useActiveBasicTone();
  if (!props.shown || tone === null) return null;
  return (
    <PixelTextureBackdrop
      colors={{ ground: BASIC_TONE_OPTIONS[tone].base, text: BASIC_TONE_OPTIONS[tone].text }}
      className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
    />
  );
}
