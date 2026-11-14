/**
 * The Threads panel's toggle, beside the right panel's, on a bot's conversation and on its work —
 * see `.fork/customizations.yaml#fork-bot-work-threads`.
 */
import type { ScopedThreadRef } from "@t3tools/contracts";
import { YarnIcon } from "lucide-react";

import { Toggle } from "~/components/ui/toggle";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";

import { toggleBotThreadsPanel } from "./botThreadsPanelStore";
import { useBotThreadsPanelBot, useBotThreadsPanelOpen } from "./useBotWorkOwner";

export function BotThreadsPanelToggle(props: { readonly threadRef: ScopedThreadRef | null }) {
  const { threadRef } = props;
  const botRef = useBotThreadsPanelBot(threadRef);
  const open = useBotThreadsPanelOpen(botRef);
  if (botRef === null || threadRef === null) return null;
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="flex shrink-0" data-fork-panel-toggle />}>
        <Toggle
          aria-label="Toggle threads panel"
          className="shrink-0 [-webkit-app-region:no-drag]"
          data-fork-bot-threads-toggle=""
          onPressedChange={(_pressed, details) =>
            toggleBotThreadsPanel({
              botRef,
              threadRef,
              trigger: details.event.target instanceof Element ? details.event.target : null,
            })
          }
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
