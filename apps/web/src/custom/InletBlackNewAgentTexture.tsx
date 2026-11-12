/**
 * Inlet Black's new-agent stage — see `.fork/customizations.yaml#fork-inlet-black-texture`.
 * The portfolio's pixel texture comes in from the panel's right edge behind the draft, and
 * keeps moving while the screen is open (paused while the window is in the background).
 */
import { useActiveInletColor } from "./forkTheme";
import { PixelTextureBackdrop } from "./pixelTexture/PixelTextureBackdrop";

/** Inlet Black's panel cream and ink (theme.custom.palettes.css). */
const COLORS = { ground: "#f8f3d8", text: "#1c1c1a" };

export function InletBlackNewAgentTexture(props: { readonly shown: boolean }) {
  const inletColor = useActiveInletColor();
  if (!props.shown || inletColor !== "black") return null;
  return (
    <PixelTextureBackdrop
      colors={COLORS}
      settleMs={Number.POSITIVE_INFINITY}
      className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
    />
  );
}
