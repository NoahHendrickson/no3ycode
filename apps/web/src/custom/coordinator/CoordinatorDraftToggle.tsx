/** The new-thread composer's "Coordinator" switch, a checkbox pill over the card's top-right
    corner — see `.fork/customizations.yaml#fork-coordinator-threads`. */
import { Checkbox } from "~/components/ui/checkbox";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";

import { WorkflowSquare10Icon } from "../icons/lucide-hugeicons";

export function CoordinatorDraftToggle(props: {
  readonly on: boolean;
  readonly onChange: (on: boolean) => void;
  readonly disabled: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          // The pill (ComposerShell.css), last and pushed right in the chip row. The label makes
          // the whole pill toggle the checkbox, the one focusable control.
          <label
            data-fork-coordinator-toggle
            className="order-last ml-auto"
            // The editor keeps focus on a click, as it does for the composer's other controls.
            onPointerDown={(event) => event.preventDefault()}
          />
        }
      >
        <Checkbox
          checked={props.on}
          disabled={props.disabled}
          onCheckedChange={(checked) => props.onChange(checked)}
        />
        <span className="flex items-center gap-1">
          <WorkflowSquare10Icon aria-hidden className="size-4" />
          Coordinator
        </span>
      </TooltipTrigger>
      <TooltipPopup side="top">
        Start as a coordinator: it hands the work to delegated threads and stays free to talk
      </TooltipPopup>
    </Tooltip>
  );
}
