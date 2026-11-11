/**
 * Inlet's colour swatches — see `.fork/customizations.yaml#fork-inlet-theme`.
 * Same shape as the project icon colour picker: a ring marks the pick, and each
 * swatch names its colour on hover.
 */

import { Tooltip, TooltipPopup, TooltipTrigger } from "../components/ui/tooltip";
import { cn } from "../lib/utils";
import { INLET_COLOR_OPTIONS, INLET_COLORS, type InletColor } from "./forkTheme";

export function ForkInletColorPicker(props: {
  readonly value: InletColor;
  readonly onChange: (color: InletColor) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Inlet colour">
      {INLET_COLORS.map((color) => {
        const option = INLET_COLOR_OPTIONS[color];
        return (
          <Tooltip key={color}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={option.label}
                  aria-pressed={props.value === color}
                  className={cn(
                    "flex size-7 cursor-pointer items-center justify-center rounded-full border border-transparent outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    props.value === color && "border-foreground/64",
                  )}
                  onClick={() => props.onChange(color)}
                />
              }
            >
              <span
                className="size-5 rounded-full ring-1 ring-foreground/12 ring-inset"
                style={{ background: option.swatch }}
              />
            </TooltipTrigger>
            <TooltipPopup>{option.label}</TooltipPopup>
          </Tooltip>
        );
      })}
    </div>
  );
}
