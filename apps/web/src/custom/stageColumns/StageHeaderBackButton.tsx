/**
 * The way back to a thread's parent, just left of its title — see
 * `.fork/customizations.yaml#fork-stage-header`. On Inlet only: the other palettes show the
 * breadcrumb's parent crumb, which already opens the parent in one click.
 */
import type { ThreadId } from "@t3tools/contracts";
import { ArrowLeftIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";

import { useIsInletActive } from "../forkActivePalette";

export function StageHeaderBackButton(props: {
  readonly parent: { readonly threadId: ThreadId; readonly title: string } | null;
  readonly onOpen: (threadId: ThreadId) => void;
}) {
  const inlet = useIsInletActive();
  const { parent } = props;
  if (!inlet || parent === null) return null;
  const label = `Back to ${parent.title}`;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            data-fork-stage-header-back=""
            onClick={() => props.onOpen(parent.threadId)}
          />
        }
      >
        <ArrowLeftIcon className="size-4" />
      </TooltipTrigger>
      <TooltipPopup side="bottom">{label}</TooltipPopup>
    </Tooltip>
  );
}
