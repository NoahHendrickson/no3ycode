/**
 * The search, filter and sort buttons in a bot's Threads panel header, beside its close button —
 * see `.fork/customizations.yaml#fork-bot-work-threads`.
 */
import { ArrowUpDownIcon, ListFilterIcon, SearchIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "~/components/ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";

import { ScopeCheckboxItem } from "../SidebarV2ChromeRows";
import { BOT_WORK_GROUPS, BOT_WORK_SORT_LABELS, BOT_WORK_SORTS, type BotWorkSort } from "./botWork";
import {
  type BotThreadsView,
  clearBotThreadsFilters,
  setBotThreadsSort,
  updateBotThreadsView,
  useBotThreadsPanelStore,
} from "./botThreadsPanelStore";

function toggled<T>(set: ReadonlySet<T>, value: T): ReadonlySet<T> {
  const next = new Set(set);
  if (!next.delete(value)) next.add(value);
  return next;
}

export function BotThreadsPanelControls(props: {
  readonly botKey: string;
  readonly view: BotThreadsView;
  /** The projects the bot's threads are in; the menu offers them where there is a choice. */
  readonly projects: ReadonlyArray<{ readonly id: string; readonly title: string }>;
}) {
  const { botKey, view } = props;
  const sort = useBotThreadsPanelStore((state) => state.sort);
  const searching = view.query !== null;
  const filtered = view.groups.size > 0 || view.projectIds.size > 0;
  const searchLabel = searching ? "Close search" : "Search threads";
  const filterLabel = filtered ? "Filter threads (filtered)" : "Filter threads";
  const sortLabel = `Sort threads: ${BOT_WORK_SORT_LABELS[sort]}`;
  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={searchLabel}
              aria-pressed={searching}
              onClick={() => updateBotThreadsView(botKey, { query: searching ? null : "" })}
              size="icon-sm"
              variant={searching ? "secondary" : "ghost"}
              data-testid="bot-threads-search"
            />
          }
        >
          <SearchIcon className="size-4" />
        </TooltipTrigger>
        <TooltipPopup side="bottom">{searchLabel}</TooltipPopup>
      </Tooltip>
      <Menu>
        <Tooltip>
          <TooltipTrigger
            render={
              <MenuTrigger
                render={
                  <Button
                    aria-label={filterLabel}
                    size="icon-sm"
                    variant={filtered ? "secondary" : "ghost"}
                    data-testid="bot-threads-filter"
                  />
                }
              />
            }
          >
            <ListFilterIcon className="size-4" />
          </TooltipTrigger>
          <TooltipPopup side="bottom">{filterLabel}</TooltipPopup>
        </Tooltip>
        <MenuPopup align="end" className="min-w-48">
          <MenuGroup>
            <MenuGroupLabel>Status</MenuGroupLabel>
            {BOT_WORK_GROUPS.map((group) => (
              <ScopeCheckboxItem
                key={group.key}
                checked={view.groups.has(group.key)}
                onCheckedChange={() =>
                  updateBotThreadsView(botKey, { groups: toggled(view.groups, group.key) })
                }
              >
                {group.label}
              </ScopeCheckboxItem>
            ))}
          </MenuGroup>
          {props.projects.length > 1 || view.projectIds.size > 0 ? (
            <>
              <MenuSeparator className="-mx-1" />
              <MenuGroup>
                <MenuGroupLabel>Project</MenuGroupLabel>
                {props.projects.map((project) => (
                  <ScopeCheckboxItem
                    key={project.id}
                    checked={view.projectIds.has(project.id)}
                    onCheckedChange={() =>
                      updateBotThreadsView(botKey, {
                        projectIds: toggled(view.projectIds, project.id),
                      })
                    }
                  >
                    <span className="truncate">{project.title}</span>
                  </ScopeCheckboxItem>
                ))}
              </MenuGroup>
            </>
          ) : null}
          {filtered ? (
            <>
              <MenuSeparator className="-mx-1" />
              <MenuItem onClick={() => clearBotThreadsFilters(botKey)}>Clear filters</MenuItem>
            </>
          ) : null}
        </MenuPopup>
      </Menu>
      <Menu>
        <Tooltip>
          <TooltipTrigger
            render={
              <MenuTrigger
                render={
                  <Button
                    aria-label={sortLabel}
                    size="icon-sm"
                    variant="ghost"
                    data-testid="bot-threads-sort"
                  />
                }
              />
            }
          >
            <ArrowUpDownIcon className="size-4" />
          </TooltipTrigger>
          <TooltipPopup side="bottom">{sortLabel}</TooltipPopup>
        </Tooltip>
        <MenuPopup align="end" className="min-w-40">
          <MenuRadioGroup
            value={sort}
            onValueChange={(value) => setBotThreadsSort(value as BotWorkSort)}
          >
            {BOT_WORK_SORTS.map((option) => (
              <MenuRadioItem key={option} value={option} closeOnClick>
                {BOT_WORK_SORT_LABELS[option]}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuPopup>
      </Menu>
    </>
  );
}
