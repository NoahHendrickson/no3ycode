/** A checkbox and its label as one pill — see `.fork/customizations.yaml#fork-coordinator-threads`.
    The pill owns its structure and type (CheckboxPill.css); its surface is the caller's, through a
    data attribute or class on the outer label, over a neutral default. */
import type { ComponentProps, ReactNode } from "react";

import { Checkbox } from "~/components/ui/checkbox";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";

import type { LucideIcon } from "./icons/lucide-hugeicons";
import "./CheckboxPill.css";

export interface CheckboxPillProps {
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly label: string;
  readonly disabled?: boolean;
  /** Drawn at 16px between the checkbox and the label. */
  readonly icon?: LucideIcon;
  readonly tooltip?: ReactNode;
  /** Layout only (placement in the caller's row); the surface goes on a data attribute. */
  readonly className?: string;
  /** A press leaves focus where it was (an editor beside the pill); the keyboard still reaches it. */
  readonly preserveFocus?: boolean;
  /** The caller's surface hook, e.g. `data-fork-coordinator-toggle`. */
  readonly [dataAttribute: `data-${string}`]: string | boolean | undefined;
}

export function CheckboxPill({
  checked,
  onCheckedChange,
  label,
  disabled = false,
  icon: Icon,
  tooltip,
  className,
  preserveFocus = false,
  ...dataAttributes
}: CheckboxPillProps) {
  // The label makes the whole pill toggle the checkbox, the one focusable control.
  const pillProps: ComponentProps<"label"> = {
    ...dataAttributes,
    className,
    ...(preserveFocus ? { onPointerDown: (event) => event.preventDefault() } : {}),
  };
  const content = (
    <>
      <Checkbox
        // Over glass the default border washes out.
        variant="contrast"
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => onCheckedChange(next)}
      />
      <span className="flex items-center gap-1">
        {Icon ? <Icon aria-hidden className="size-4" /> : null}
        {label}
      </span>
    </>
  );
  if (tooltip === undefined)
    return (
      <label {...pillProps} data-fork-checkbox-pill="">
        {content}
      </label>
    );
  return (
    <Tooltip>
      <TooltipTrigger render={<label {...pillProps} data-fork-checkbox-pill="" />}>
        {content}
      </TooltipTrigger>
      <TooltipPopup side="top">{tooltip}</TooltipPopup>
    </Tooltip>
  );
}
