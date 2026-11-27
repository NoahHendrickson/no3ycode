/**
 * The Threads panel's toggle, beside the right panel's, on a bot's conversation and on its work —
 * see `.fork/customizations.yaml#fork-bot-work-threads`.
 */
import type { ScopedThreadRef } from "@t3tools/contracts";
import { MessagesSquareIcon } from "../icons/lucide-hugeicons";

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
    <BotThreadsPanelToggleView
      open={open}
      onToggle={(trigger) => toggleBotThreadsPanel({ botRef, threadRef, trigger })}
    />
  );
}

/** @public — the toggle as drawn; Storybook renders it on its own. */
export function BotThreadsPanelToggleView(props: {
  readonly open: boolean;
  /** The pressed element: the store measures the stage beside it for room for both panels. */
  readonly onToggle: (trigger: Element | null) => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="flex shrink-0" data-fork-panel-toggle />}>
        <Toggle
          aria-label="Toggle threads panel"
          className="shrink-0 [-webkit-app-region:no-drag]"
          data-fork-bot-threads-toggle=""
          onPressedChange={(_pressed, details) =>
            props.onToggle(details.event.target instanceof Element ? details.event.target : null)
          }
          pressed={props.open}
          size="sm"
          variant="ghost"
        >
          <MessagesSquareIcon className="size-4" />
        </Toggle>
      </TooltipTrigger>
      <TooltipPopup side="bottom">Toggle threads panel</TooltipPopup>
    </Tooltip>
  );
}
