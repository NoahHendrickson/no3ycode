/**
 * The tab strip and the non-Threads tabs of a sprint's Threads panel — see
 * `.fork/customizations.yaml#fork-sprints`. The strip sits in the panel's header in place of its
 * title: the open tab shows its icon and name, the others their icon alone. Threads stays the
 * panel's own list.
 */
import type { ScopedThreadRef } from "@t3tools/contracts";

import type { ComponentType } from "react";

import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { useQuietThreadShell } from "~/state/entities";

import {
  BrainIcon,
  MessagesSquareIcon,
  FileTextIcon,
  GitPullRequestIcon,
  ScrollTextIcon,
  TargetIcon,
} from "../icons/lucide-hugeicons";

import { Tab, Tabs } from "../Tabs";
import { SprintContext } from "./SprintContext";
import { SprintFileEditor } from "./SprintFileEditor";
import { SprintGoal } from "./SprintGoal";
import { SprintPullRequests } from "./SprintPullRequests";
import {
  isSprintPanelTab,
  SPRINT_PANEL_TAB_FILES,
  SPRINT_PANEL_TABS,
  type SprintPanelTab,
  setSprintPanelTab,
} from "./sprintPanelState";

/** Threads wears the Threads panel toggle's messages icon. */
const TAB_ICONS: Record<SprintPanelTab, ComponentType<{ readonly className?: string }>> = {
  threads: MessagesSquareIcon,
  pullRequests: GitPullRequestIcon,
  goal: TargetIcon,
  library: FileTextIcon,
  instructions: ScrollTextIcon,
  memory: BrainIcon,
};

export function SprintPanelTabStrip(props: {
  readonly sprintKey: string;
  readonly tab: SprintPanelTab;
}) {
  return (
    // Scrolls sideways where the panel is too narrow for every tab beside the header's buttons.
    <div className="flex min-w-0 flex-1 overflow-x-auto [-webkit-app-region:no-drag] [scrollbar-width:none]">
      <h2 className="sr-only">{SPRINT_PANEL_TABS.find((tab) => tab.id === props.tab)?.label}</h2>
      <Tabs
        aria-label="Sprint"
        value={[props.tab]}
        onValueChange={(value) => {
          const next = value[0];
          if (isSprintPanelTab(next)) setSprintPanelTab(props.sprintKey, next);
        }}
        data-fork-sprint-tabs=""
      >
        {SPRINT_PANEL_TABS.map((tab) => {
          const Icon = TAB_ICONS[tab.id];
          const open = tab.id === props.tab;
          // One element per tab whether open or not, so its name can open and close in place.
          return (
            <Tooltip key={tab.id}>
              <TooltipTrigger
                render={
                  <Tab
                    value={tab.id}
                    aria-label={tab.label}
                    // An icon's width of side room, so a closed tab is nearly square.
                    className="px-1.5"
                    data-testid={`sprint-tab-${tab.id}`}
                  />
                }
              >
                {/* One child: the strip's glide holds a tab's first child still as the pill moves. */}
                <span className="flex items-center">
                  <Icon className="size-4 shrink-0" />
                  {/* The name's column opens from nothing on the glide's own timing, so the pill
                      slides and grows as one; reduced motion keeps only the fade. */}
                  <span
                    aria-hidden
                    className={cn(
                      "grid transition-[grid-template-columns,opacity] duration-240 ease-(--ease-drawer) motion-reduce:transition-opacity",
                      open ? "opacity-100" : "opacity-0",
                    )}
                    style={{ gridTemplateColumns: open ? "1fr" : "0fr" }}
                  >
                    <span className="overflow-hidden whitespace-nowrap">
                      <span className="block ps-1.5 pe-0.5 text-interface-label">{tab.label}</span>
                    </span>
                  </span>
                </span>
              </TooltipTrigger>
              <TooltipPopup side="bottom">{tab.label}</TooltipPopup>
            </Tooltip>
          );
        })}
      </Tabs>
    </div>
  );
}

const DESCRIPTIONS = {
  instructions:
    "Your standing instructions. The sprint follows them, and every thread it starts gets them in its first message.",
  memory:
    "What every thread should know: decisions, constraints, gotchas. Threads read it when they start and add to it.",
} as const satisfies Record<keyof typeof SPRINT_PANEL_TAB_FILES, string>;

export function SprintPanelTabContent(props: {
  readonly sprintRef: ScopedThreadRef;
  readonly tab: Exclude<SprintPanelTab, "threads">;
}) {
  const folder = useQuietThreadShell(props.sprintRef)?.worktreePath ?? null;
  if (props.tab === "pullRequests") return <SprintPullRequests sprintRef={props.sprintRef} />;
  if (folder === null) return null;
  if (props.tab === "library") return <SprintContext sprintRef={props.sprintRef} folder={folder} />;
  if (props.tab === "goal") return <SprintGoal sprintRef={props.sprintRef} folder={folder} />;
  return (
    <SprintFileEditor
      // A fresh editor per file, so a draft never follows the owner to another tab.
      key={props.tab}
      sprintRef={props.sprintRef}
      folder={folder}
      relativePath={SPRINT_PANEL_TAB_FILES[props.tab]}
      description={DESCRIPTIONS[props.tab]}
      placeholder={
        props.tab === "instructions" ? "For example: Keep every change behind a flag." : undefined
      }
      // The turn hook shows MEMORY.md whenever it changed, whoever changed it.
      announceEdits={props.tab === "instructions"}
    />
  );
}
