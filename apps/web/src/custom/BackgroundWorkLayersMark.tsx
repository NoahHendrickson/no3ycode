/**
 * The background-work chip's mark — see `.fork/customizations.yaml#fork-composer-shell`.
 * Hugeicons' Layers02 outline with a fill that travels front → middle → back. Each layer's fill
 * is its own <svg>, so ComposerShell.css fades whole elements, which the compositor runs.
 */
import { Layers02Icon } from "@hugeicons/core-free-icons";
import { useId } from "react";

import { HugeGlyph } from "./icons/lucide-hugeicons";

const attrs = (index: number) => Layers02Icon[index]?.[1] ?? {};
const front = attrs(0);
// Each behind square's outline stops where the square in front covers its top-right corner;
// closing it straight is enough, since the mask hides that corner anyway.
const MIDDLE = `${attrs(1).d}L17.5 6.5Z`;
const BACK = `${attrs(2).d}L13 11Z`;

/** Front to back. Each fill is masked by the layer in front of it, up to that layer's line
    centre, so the line covers the join; stopping at its outer edge leaves an antialiasing seam. */
const LAYERS = [
  {
    layer: "front",
    shape: <rect x={front.x} y={front.y} width={front.width} height={front.height} rx={front.rx} />,
  },
  { layer: "middle", shape: <path d={MIDDLE} /> },
  { layer: "back", shape: <path d={BACK} /> },
] as const;

function LayerFill(props: { readonly index: number }) {
  const { layer, shape } = LAYERS[props.index]!;
  const cover = LAYERS[props.index - 1]?.shape;
  const maskId = `fork-layer-${layer}-${useId().replace(/[^\w-]/g, "")}`;
  return (
    <svg data-fork-layer-fill={layer} viewBox="0 0 24 24" fill="currentColor">
      {cover ? (
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
            <rect width="24" height="24" fill="white" />
            <g fill="black">{cover}</g>
          </mask>
        </defs>
      ) : null}
      <g mask={cover ? `url(#${maskId})` : undefined}>{shape}</g>
    </svg>
  );
}

export function BackgroundWorkLayersMark() {
  return (
    <>
      <HugeGlyph data={Layers02Icon} filled={false} />
      {LAYERS.map(({ layer }, index) => (
        <LayerFill key={layer} index={index} />
      ))}
    </>
  );
}
