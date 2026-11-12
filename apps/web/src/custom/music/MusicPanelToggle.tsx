/**
 * The music button beside the right panel toggle: opens the panel on its Music tab, closes
 * it when that tab is showing. Renders nothing without the desktop's music bridge (the web
 * and mobile). See .fork/customizations.yaml#fork-music-panel.
 */
import type { ScopedThreadRef } from "@t3tools/contracts";
import { MusicIcon } from "lucide-react";

import { Toggle } from "~/components/ui/toggle";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { selectActiveRightPanel, useRightPanelStore } from "~/rightPanelStore";

import { readMusicBridge } from "./musicBridge";
import { launchMusicWhenClosed } from "./musicStore";

export function MusicPanelToggle(props: { threadRef: ScopedThreadRef | null; available: boolean }) {
  const { threadRef, available } = props;
  const open = useRightPanelStore(
    (state) => selectActiveRightPanel(state.byThreadKey, threadRef) === "music",
  );
  if (readMusicBridge() === null) return null;
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="flex shrink-0" data-fork-panel-toggle />}>
        <Toggle
          aria-label="Toggle music"
          className="shrink-0 [-webkit-app-region:no-drag]"
          data-fork-music-toggle=""
          disabled={!available || threadRef === null}
          onPressedChange={() => {
            if (threadRef === null) return;
            if (!open) launchMusicWhenClosed();
            useRightPanelStore.getState().toggle(threadRef, "music");
          }}
          pressed={open}
          size="sm"
          variant="ghost"
        >
          <MusicIcon className="size-4" />
        </Toggle>
      </TooltipTrigger>
      <TooltipPopup side="bottom">Toggle music</TooltipPopup>
    </Tooltip>
  );
}
