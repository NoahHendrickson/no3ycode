/**
 * The pin inside the right panel's Music tab: keeps Music open across threads
 * (MusicPanelToggle carries it). Sized like the browser tab's mute button beside it.
 * See .fork/customizations.yaml#fork-music-panel.
 */
import { PinIcon } from "lucide-react";

import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import { setMusicKeepOpen, useMusicKeepOpen } from "./musicKeepOpen";

export function MusicTabPin() {
  const keepOpen = useMusicKeepOpen();
  const label = keepOpen ? "Stop keeping music open" : "Keep music open across threads";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            aria-label={label}
            aria-pressed={keepOpen}
            className={cn(
              "ml-1 flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm hover:bg-muted",
              keepOpen ? "bg-muted text-foreground" : "text-muted-foreground",
            )}
            data-fork-music-tab-pin=""
            onClick={(event) => {
              // The tab activates on click; the pin only toggles.
              event.stopPropagation();
              setMusicKeepOpen(!keepOpen);
            }}
            type="button"
          >
            <PinIcon className="size-3" />
          </button>
        }
      />
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}
