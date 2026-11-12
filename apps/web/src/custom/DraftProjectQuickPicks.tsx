/** An unassigned draft's recent projects as pills, with a chevron for the
    full menu — see `.fork/customizations.yaml#fork-draft-project-quick-picks`. */
import type { ReactNode } from "react";

import { ProjectFavicon } from "~/components/ProjectFavicon";
import { Button } from "~/components/ui/button";
import { Menu, MenuTrigger } from "~/components/ui/menu";
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import type { SidebarProjectPickerEntry } from "~/sidebarProjectGrouping";
import { DraftProjectMenuPopup } from "./DraftProjectMenuPopup";
import {
  ChevronDownIcon,
  FolderIcon,
  MessageSquareDashedIcon,
  PlusIcon,
} from "./icons/lucide-phosphor";
import { NO_PROJECT_VALUE, type DraftProjectChoices } from "./useDraftProjectChoices";

export function DraftProjectQuickPicks(props: {
  readonly choices: DraftProjectChoices;
  readonly recentEntries: readonly SidebarProjectPickerEntry[];
}) {
  const { choices } = props;
  return (
    <Menu>
      {/* One group: the first tooltip comes quickly, and the next pill's takes over at once. */}
      <TooltipProvider delay={150} closeDelay={0} timeout={400}>
        <span data-fork-project-quick-picks="" className="flex min-w-0 items-center gap-1.5">
          {choices.noProjectEnvironmentId !== null ? (
            <QuickPick
              value={NO_PROJECT_VALUE}
              label="No project"
              icon={<MessageSquareDashedIcon className="size-4 shrink-0" />}
              onPick={choices.pick}
            />
          ) : null}
          {props.recentEntries.map((entry) => (
            <QuickPick
              key={entry.group.projectKey}
              value={entry.group.projectKey}
              label={entry.group.displayName}
              icon={
                <ProjectFavicon
                  project={entry.targetProject}
                  className="size-4 shrink-0"
                  fallbackIcon={FolderIcon}
                />
              }
              onPick={choices.pick}
            />
          ))}
          <MenuTrigger
            render={
              <Button
                type="button"
                size="xs"
                variant="ghost"
                aria-label="All projects"
                data-testid="draft-project-pill"
                data-composer-context-control
                data-project-assigned="false"
              />
            }
          >
            <ChevronDownIcon className="size-3 shrink-0 opacity-50" />
          </MenuTrigger>
        </span>
      </TooltipProvider>
      <DraftProjectMenuPopup choices={choices} />
    </Menu>
  );
}

/** One project's pill: its icon then a plus. */
function QuickPick(props: {
  readonly value: string;
  readonly label: string;
  readonly icon: ReactNode;
  readonly onPick: (value: string, pill: Element) => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            size="xs"
            variant="ghost"
            aria-label={`New agent in ${props.label}`}
            data-fork-project-quick-pick=""
            data-composer-context-control
            onClick={(event) => props.onPick(props.value, event.currentTarget)}
          />
        }
      >
        {props.icon}
        <PlusIcon className="size-3 shrink-0" />
      </TooltipTrigger>
      <TooltipPopup side="top" data-fork-project-quick-pick-tip="">
        {props.label}
      </TooltipPopup>
    </Tooltip>
  );
}
