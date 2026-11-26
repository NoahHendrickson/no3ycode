/**
 * The sidebar header's Code / Chat switch — see `.fork/customizations.yaml#fork-chat-mode`.
 * Figma t3-fork 676:42030: a 28px track with each mode an icon tab a little wider
 * than tall, the chosen one raised in the sidebar's own fill.
 */
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";

import type { ForkSidebarMode } from "./chatMode";
import { CodeIcon, MessageSquareTextIcon } from "./icons/lucide-hugeicons";
import { IconTab, Tabs } from "./Tabs";

const MODES = [
  { mode: "code", label: "Code", Icon: CodeIcon },
  { mode: "chat", label: "Chat", Icon: MessageSquareTextIcon },
] as const;

export function SidebarModeTabs(props: {
  readonly mode: ForkSidebarMode;
  readonly onModeChange: (mode: ForkSidebarMode) => void;
}) {
  return (
    <Tabs
      aria-label="Sidebar mode"
      size="md"
      value={[props.mode]}
      onValueChange={(value) => {
        const next = value[0];
        if (next === "code" || next === "chat") props.onModeChange(next);
      }}
      data-fork-sidebar-mode-tabs=""
      className="gap-px!"
    >
      {MODES.map(({ mode, label, Icon }) => (
        <Tooltip key={mode}>
          <TooltipTrigger
            render={
              <IconTab value={mode} aria-label={label} className="aspect-auto px-2.5">
                <Icon className="size-4" />
              </IconTab>
            }
          />
          <TooltipPopup side="bottom">{label}</TooltipPopup>
        </Tooltip>
      ))}
    </Tabs>
  );
}
