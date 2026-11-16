/**
 * A row of colour swatches — see `.fork/customizations.yaml#fork-basic-theme` and `#fork-inlet-theme`.
 * Same shape as the project icon colour picker: a ring marks the pick, and each swatch names its
 * colour on hover.
 */

import { Tooltip, TooltipPopup, TooltipTrigger } from "../components/ui/tooltip";
import { cn } from "../lib/utils";

export function ForkSwatchPicker<T extends string>(props: {
  readonly label: string;
  readonly options: ReadonlyArray<{
    readonly value: T;
    readonly label: string;
    readonly swatch: string;
  }>;
  readonly value: T;
  readonly onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={props.label}>
      {props.options.map((option) => (
        <Tooltip key={option.value}>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={option.label}
                aria-pressed={props.value === option.value}
                className={cn(
                  "flex size-7 cursor-pointer items-center justify-center rounded-full border border-transparent outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  props.value === option.value && "border-foreground/64",
                )}
                onClick={() => props.onChange(option.value)}
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
      ))}
    </div>
  );
}
