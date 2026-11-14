/**
 * The Threads panel's toggle, beside the right panel's, on a bot's conversation only — see
 * `.fork/customizations.yaml#fork-bot-work-threads`.
 */
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { YarnIcon } from "lucide-react";

import { Toggle } from "~/components/ui/toggle";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";

import { toggleBotThreadsPanel, useBotThreadsPanelStore } from "./botThreadsPanelStore";
import { useIsBotThread } from "./useIsBotThread";

export function BotThreadsPanelToggle(props: { readonly threadRef: ScopedThreadRef | null }) {
  const { threadRef } = props;
  const isBot = useIsBotThread(threadRef);
  const open = useBotThreadsPanelStore(
    (state) => threadRef !== null && state.openByThreadKey[scopedThreadKey(threadRef)] === true,
  );
  if (!isBot || threadRef === null) return null;
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="flex shrink-0" data-fork-panel-toggle />}>
        <Toggle
          aria-label="Toggle threads panel"
          className="shrink-0 [-webkit-app-region:no-drag]"
          data-fork-bot-threads-toggle=""
          onPressedChange={() => toggleBotThreadsPanel(threadRef)}
          pressed={open}
          size="sm"
          variant="ghost"
        >
          <YarnIcon className="size-4" />
        </Toggle>
      </TooltipTrigger>
      <TooltipPopup side="bottom">Toggle threads panel</TooltipPopup>
    </Tooltip>
  );
}
