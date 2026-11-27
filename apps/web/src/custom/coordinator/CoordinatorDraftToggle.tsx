/** The new-thread composer's "Coordinator" switch, a CheckboxPill over the card's top-right corner,
    in the card's own surface (ComposerShell.css) — see
    `.fork/customizations.yaml#fork-coordinator-threads`. */
import { CheckboxPill } from "../CheckboxPill";
import { WorkflowSquare10Icon } from "../icons/lucide-hugeicons";

export function CoordinatorDraftToggle(props: {
  readonly on: boolean;
  readonly onChange: (on: boolean) => void;
  readonly disabled: boolean;
}) {
  return (
    <CheckboxPill
      data-fork-coordinator-toggle
      // Last and pushed right in the chip row above the composer.
      className="order-last ml-auto"
      // The editor keeps focus on a click, as it does for the composer's other controls.
      preserveFocus
      checked={props.on}
      onCheckedChange={props.onChange}
      disabled={props.disabled}
      label="Coordinator"
      icon={WorkflowSquare10Icon}
      tooltip="Start as a coordinator: it hands the work to delegated threads and stays free to talk"
    />
  );
}
