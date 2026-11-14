/** A stage panel's close button, at the right end of its own header — see
    `.fork/customizations.yaml#fork-stage-columns`. The size of the header's toggles. */
import { XIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";

export function StagePanelCloseButton(props: {
  readonly label: string;
  readonly onClose: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={props.label}
            onClick={props.onClose}
            size="icon-sm"
            variant="ghost"
            data-fork-stage-panel-close=""
          />
        }
      >
        <XIcon className="size-4" />
      </TooltipTrigger>
      <TooltipPopup side="bottom">{props.label}</TooltipPopup>
    </Tooltip>
  );
}
