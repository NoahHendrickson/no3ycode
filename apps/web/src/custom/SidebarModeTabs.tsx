/**
 * The sidebar header's Code / Chat switch — see `.fork/customizations.yaml#fork-chat-mode`.
 * Figma t3-fork 676:42030: a 28px track with each mode a 28px icon tab, the
 * chosen one raised in the sidebar's own fill.
 */
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";

import type { ForkSidebarMode } from "./chatMode";
import { CodeIcon, MessageSquareTextIcon } from "./icons/lucide-phosphor";
import { SegmentedTab, SegmentedTabs } from "./SegmentedTabs";

const MODES = [
  { mode: "code", label: "Code", Icon: CodeIcon },
  { mode: "chat", label: "Chat", Icon: MessageSquareTextIcon },
] as const;

export function SidebarModeTabs(props: {
  readonly mode: ForkSidebarMode;
  readonly onModeChange: (mode: ForkSidebarMode) => void;
}) {
  return (
    <SegmentedTabs
      aria-label="Sidebar mode"
      value={[props.mode]}
      onValueChange={(value) => {
        const next = value[0];
        if (next === "code" || next === "chat") props.onModeChange(next);
      }}
      data-fork-sidebar-mode-tabs=""
      className="h-7 shrink-0 rounded-xl bg-sidebar-control-surface p-0 dark:bg-sidebar-control-surface"
    >
      {MODES.map(({ mode, label, Icon }) => (
        <Tooltip key={mode}>
          <TooltipTrigger
            render={
              <SegmentedTab
                value={mode}
                aria-label={label}
                className="size-7 rounded-xl border border-transparent px-0 text-sidebar-muted-foreground hover:text-sidebar-foreground data-pressed:border-sidebar-border data-pressed:bg-sidebar data-pressed:text-sidebar-foreground dark:data-pressed:bg-sidebar dark:data-pressed:text-sidebar-foreground"
              >
                <Icon className="size-4" />
              </SegmentedTab>
            }
          />
          <TooltipPopup side="bottom">{label}</TooltipPopup>
        </Tooltip>
      ))}
    </SegmentedTabs>
  );
}
