/**
 * Inlet's colour swatches — see `.fork/customizations.yaml#fork-inlet-theme`.
 * Same shape as the project icon colour picker: a ring marks the pick.
 */

import { cn } from "../lib/utils";
import { INLET_COLOR_OPTIONS, INLET_COLORS, type InletColor } from "./forkTheme";

export function ForkInletColorPicker(props: {
  readonly value: InletColor;
  readonly onChange: (color: InletColor) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Inlet colour">
      {INLET_COLORS.map((color) => {
        const option: { frame: string; swatch?: string } = INLET_COLOR_OPTIONS[color];
        return (
          <button
            key={color}
            type="button"
            aria-label={INLET_COLOR_OPTIONS[color].label}
            aria-pressed={props.value === color}
            className={cn(
              "flex size-7 items-center justify-center rounded-full border border-transparent outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              props.value === color && "border-foreground/64",
            )}
            onClick={() => props.onChange(color)}
          >
            <span
              className="size-5 rounded-full ring-1 ring-foreground/12 ring-inset"
              style={{ background: option.swatch ?? option.frame }}
            />
          </button>
        );
      })}
    </div>
  );
}
