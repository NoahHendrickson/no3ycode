/**
 * The music button beside the right panel toggle: opens the panel on its Music tab, closes
 * it when that tab is showing. Renders nothing without the desktop's music bridge (the web
 * and mobile). See .fork/customizations.yaml#fork-music-panel.
 */
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { MusicIcon } from "lucide-react";
import { useEffect } from "react";

import { Toggle } from "~/components/ui/toggle";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { selectActiveRightPanel, useRightPanelStore } from "~/rightPanelStore";

import { readMusicBridge } from "./musicBridge";
import { getMusicKeepOpen } from "./musicKeepOpen";
import { openMusic } from "./musicStore";

/** The thread the button last left. It remounts on the same thread as the panel opens or
    closes (moving between the chat header and the panel), and only arriving carries Music. */
let leftThreadKey: string | null = null;

export function MusicPanelToggle(props: {
  threadRef: ScopedThreadRef | null;
  available: boolean;
  /** False on a new agent's draft, which keeps its id once its first message starts it. */
  started: boolean;
}) {
  const { threadRef, available, started } = props;
  const open = useRightPanelStore(
    (state) => selectActiveRightPanel(state.byThreadKey, threadRef) === "music",
  );
  const threadKey = threadRef === null ? null : scopedThreadKey(threadRef);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- carries the panel to the thread just navigated to; the panel store is per thread
  useEffect(() => {
    // Not yet able to show a panel, or a draft not yet sent: the arrival waits until then.
    if (threadRef === null || threadKey === null || !available || !started) return;
    if (threadKey !== leftThreadKey && getMusicKeepOpen() && readMusicBridge() !== null) {
      const panels = useRightPanelStore.getState();
      if (selectActiveRightPanel(panels.byThreadKey, threadRef) !== "music") {
        panels.open(threadRef, "music");
      }
    }
    return () => {
      leftThreadKey = threadKey;
    };
  }, [threadKey, threadRef, available, started]);
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
            // The click itself asks for ah ahh, so a panel that merely remounts never starts it.
            if (!open) void openMusic();
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
