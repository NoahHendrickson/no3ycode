/** An unassigned draft's recent projects as pills, with a chevron for the
    full menu — see `.fork/customizations.yaml#fork-draft-project-quick-picks`. */
import type { ReactNode } from "react";

import { ProjectFavicon, type ProjectFaviconProject } from "~/components/ProjectFavicon";
import { Button } from "~/components/ui/button";
import { Menu, MenuTrigger } from "~/components/ui/menu";
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { DraftProjectMenuPopup } from "./DraftProjectMenuPopup";
import {
  ChevronDownIcon,
  FolderIcon,
  MessageSquareDashedIcon,
  PlusIcon,
} from "./icons/lucide-phosphor";
import { NO_PROJECT_VALUE, type DraftProjectMenuChoices } from "./useDraftProjectChoices";

interface QuickPickEntry {
  readonly group: { readonly projectKey: string; readonly displayName: string };
  readonly targetProject: ProjectFaviconProject;
}

export function DraftProjectQuickPicks(props: {
  readonly choices: DraftProjectMenuChoices;
  readonly recentEntries: readonly QuickPickEntry[];
}) {
  const { choices } = props;
  return (
    <Menu>
      {/* One group: the first tooltip comes quickly, and the next pill's takes over at once. */}
      <TooltipProvider delay={150} closeDelay={0} timeout={400}>
        <span data-fork-project-quick-picks="" className="flex min-w-0 items-center gap-1.5">
          {/* The pills scroll sideways in a narrow composer so the chevron, the
              only way to every project and Add a project, is never clipped. A
              scroller clips both axes: -m-1 p-1 leaves room for Glass's halo. */}
          <span className="-m-1 flex min-w-0 items-center gap-1.5 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
          </span>
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
