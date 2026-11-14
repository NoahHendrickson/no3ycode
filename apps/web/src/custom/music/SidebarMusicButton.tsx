/**
 * The music button beside Settings in the sidebar footer: shows or hides the music strip above
 * it. Renders nothing without the desktop's music bridge (the web and mobile).
 * See .fork/customizations.yaml#fork-music-panel.
 */
import { MusicIcon } from "lucide-react";

import { SidebarMenuButton, SidebarMenuItem } from "~/components/ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";

import { readMusicBridge } from "./musicBridge";
import { openMusic } from "./musicStore";
import { setMusicStripMode, useMusicStripMode } from "./musicStripMode";

export function SidebarMusicButton() {
  const open = useMusicStripMode() !== "closed";
  if (readMusicBridge() === null) return null;
  return (
    <SidebarMenuItem className="shrink-0">
      <Tooltip>
        <TooltipTrigger
          render={
            <SidebarMenuButton
              aria-label="Music"
              aria-pressed={open}
              data-fork-music-toggle=""
              onClick={() => {
                // The click itself asks for ah ahh, so a strip that merely remounts never starts it.
                if (!open) void openMusic();
                setMusicStripMode(open ? "closed" : "open");
              }}
              size="icon"
            >
              <MusicIcon />
            </SidebarMenuButton>
          }
        />
        <TooltipPopup side="top">Music</TooltipPopup>
      </Tooltip>
    </SidebarMenuItem>
  );
}
