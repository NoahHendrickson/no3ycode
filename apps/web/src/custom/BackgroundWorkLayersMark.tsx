/**
 * The background-work chip's mark — see `.fork/customizations.yaml#fork-composer-shell`.
 * Hugeicons' Layers02 outline with a fill that travels front → middle → back. Each layer's fill
 * is its own <svg>, so ComposerShell.css fades whole elements, which the compositor runs.
 */
import { Layers02Icon } from "@hugeicons/core-free-icons";
import { useId } from "react";

import { HugeGlyph } from "./icons/lucide-hugeicons";

const FRONT = { x: "11", y: "2", width: "11", height: "11", rx: "2.5" } as const;
// The outline leaves each square's top-right corner open where the square in front covers it;
// closing it straight is enough, since the mask hides that corner anyway.
const MIDDLE =
  "M11 6.50049C8.97247 6.50414 7.91075 6.55392 7.23223 7.23243C6.5 7.96467 6.5 9.14318 6.5 11.5002V12.5002C6.5 14.8572 6.5 16.0357 7.23223 16.768C7.96447 17.5002 9.14298 17.5002 11.5 17.5002H12.5C14.857 17.5002 16.0355 17.5002 16.7678 16.768C17.4463 16.0895 17.4961 15.0277 17.4997 13.0002L17.5 6.5Z";
const BACK =
  "M6.5 11.0005C4.47247 11.0041 3.41075 11.0539 2.73223 11.7324C2 12.4647 2 13.6432 2 16.0002V17.0002C2 19.3572 2 20.5357 2.73223 21.268C3.46447 22.0002 4.64298 22.0002 7 22.0002H8C10.357 22.0002 11.5355 22.0002 12.2678 21.268C12.9463 20.5895 12.9961 19.5277 12.9997 17.5002L13 11Z";

/** A behind layer's fill runs under the front square's line to its centre, so the line covers the
    join; stopping at the line's outer edge leaves an antialiasing seam. */
function BehindFill(props: {
  readonly layer: string;
  readonly d: string;
  readonly cover: "front" | "middle";
}) {
  const maskId = `fork-layer-${props.layer}-${useId().replace(/[^\w-]/g, "")}`;
  return (
    <svg data-fork-layer-fill={props.layer} viewBox="0 0 24 24" fill="none">
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="white" />
          <g fill="black">{props.cover === "front" ? <rect {...FRONT} /> : <path d={MIDDLE} />}</g>
        </mask>
      </defs>
      <path d={props.d} fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  );
}

export function BackgroundWorkLayersMark() {
  return (
    <>
      <HugeGlyph data={Layers02Icon} filled={false} />
      <svg data-fork-layer-fill="front" viewBox="0 0 24 24" fill="currentColor">
        <rect {...FRONT} />
      </svg>
      <BehindFill layer="middle" d={MIDDLE} cover="front" />
      <BehindFill layer="back" d={BACK} cover="middle" />
    </>
  );
}
