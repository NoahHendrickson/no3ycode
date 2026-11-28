/**
 * A sidebar list section of thread cards — the Sprints row (`fork-sprints`) and the Coordinators
 * row (`fork-coordinator-threads`): a heading whose label folds it, and its cards, the caller's
 * children.
 */
import type { ReactNode } from "react";

import { TooltipProvider } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import { SIDEBAR_V2_CARD_ALIGNMENT } from "./sidebarV2CardAlignment";
import { SidebarChromeGroup } from "./SidebarChromeButton";
import { SidebarV2SectionLabel } from "./SidebarV2SectionLabel";

export function SidebarV2ListSection(props: {
  readonly label: string;
  readonly testId: string;
  readonly collapsed: boolean;
  readonly onToggleCollapsed: () => void;
  readonly children: ReactNode;
  /** The section's hook for styles and tests, e.g. `data-fork-sprints-row`. */
  readonly [dataAttribute: `data-${string}`]: string | undefined;
}) {
  const { label, testId, collapsed, onToggleCollapsed, children, ...data } = props;
  return (
    <SidebarChromeGroup {...data} className="mt-6">
      <div className="flex min-h-8 items-center gap-1.5 px-3">
        <span role="heading" aria-level={2} className="min-w-0 flex-1 truncate text-left">
          <SidebarV2SectionLabel collapsed={collapsed} onToggle={onToggleCollapsed} testId={testId}>
            {label}
          </SidebarV2SectionLabel>
        </span>
      </div>
      {/* The thread list's tooltip timing, so a card's hover card opens like a thread's. */}
      <TooltipProvider delay={150} closeDelay={0} timeout={400}>
        <ul
          role="presentation"
          className={cn("mt-1 flex flex-col empty:mt-0", SIDEBAR_V2_CARD_ALIGNMENT.listGap)}
        >
          {children}
        </ul>
      </TooltipProvider>
    </SidebarChromeGroup>
  );
}
