/**
 * A row of colour swatches — see `.fork/customizations.yaml#fork-basic-theme` and `#fork-inlet-theme`.
 * Same shape as the project icon colour picker: a ring marks the pick, and each swatch names its
 * colour on hover.
 */

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";

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
    <ToggleGroupPrimitive
      className="flex flex-wrap gap-1.5"
      aria-label={props.label}
      value={[props.value]}
      onValueChange={(next) => {
        const pick = props.options.find((option) => option.value === next[0]);
        if (pick) props.onChange(pick.value);
      }}
    >
      {props.options.map((option) => (
        <Tooltip key={option.value}>
          <TooltipTrigger
            render={
              <TogglePrimitive
                value={option.value}
                aria-label={option.label}
                className={cn(
                  "flex size-7 cursor-pointer items-center justify-center rounded-full border border-transparent outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  props.value === option.value && "border-foreground/64",
                )}
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
    </ToggleGroupPrimitive>
  );
}
