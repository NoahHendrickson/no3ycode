/** The draft's project picker, opened from the project chip: search, pinned projects first,
    sorted by recent use or name — see `.fork/customizations.yaml#fork-new-agent-draft`. */
import * as Schema from "effect/Schema";
import { type ReactNode, type RefObject, useRef, useState } from "react";

import { ProjectFavicon } from "~/components/ProjectFavicon";
import { Button } from "~/components/ui/button";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxSearchInput,
} from "~/components/ui/combobox";
import { Menu, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "~/components/ui/menu";
import { Separator } from "~/components/ui/separator";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { cn } from "~/lib/utils";
import {
  arrangeDraftProjectEntries,
  type DraftProjectSort,
  matchesDraftProjectQuery,
  toggleDraftProjectPin,
} from "./draftProjectPicker.logic";
import {
  ArrowUpDownIcon,
  FolderIcon,
  FolderPlusIcon,
  MessageSquareDashedIcon,
  PinIcon,
} from "./icons/lucide-hugeicons";
import {
  NO_PROJECT_VALUE,
  openAddProject,
  type DraftProjectMenuChoices,
} from "./useDraftProjectChoices";

// Device-local, like the sidebar's grouping switches: a contracts field would put a
// fork-shaped key in a schema upstream owns.
const PINS_STORAGE_KEY = "t3code:fork:draft-project-pins:v1";
const SORT_STORAGE_KEY = "t3code:fork:draft-project-sort:v1";
const PinsSchema = Schema.Array(Schema.String);
const SortSchema = Schema.Literals(["recent", "name"]);
const NO_PINS: readonly string[] = [];

/** A favicon-less project's folder: white at low opacity tints with the dark
    glass popup; the light popup keeps upstream's muted token. */
function PickerFolderIcon(props: { readonly className?: string | undefined }) {
  return <FolderIcon className={cn(props.className, "dark:text-white/40")} />;
}

export function DraftProjectPicker(props: {
  readonly choices: DraftProjectMenuChoices;
  /** The ComboboxTrigger the popup opens from. */
  readonly children: ReactNode;
  readonly defaultOpen?: boolean | undefined;
}) {
  const { choices } = props;
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [pinnedKeys, setPinnedKeys] = useLocalStorage(PINS_STORAGE_KEY, NO_PINS, PinsSchema);
  const [sort, setSort] = useLocalStorage<DraftProjectSort, DraftProjectSort>(
    SORT_STORAGE_KEY,
    "recent",
    SortSchema,
  );
  const { pinned, rest } = arrangeDraftProjectEntries({
    entries: choices.entries,
    query,
    sort,
    pinnedKeys,
    recentKeys: choices.recentKeys,
  });
  const showNoProject =
    choices.noProjectEnvironmentId !== null && matchesDraftProjectQuery("No project", query);
  const items = [
    ...(showNoProject ? [NO_PROJECT_VALUE] : []),
    ...pinned.map((entry) => entry.group.projectKey),
    ...rest.map((entry) => entry.group.projectKey),
  ];
  const indexOf = (value: string) => items.indexOf(value);
  const projectRow = (entry: (typeof choices.entries)[number]) => (
    <DraftProjectRow
      key={entry.group.projectKey}
      entry={entry}
      index={indexOf(entry.group.projectKey)}
      pinned={pinnedKeys.includes(entry.group.projectKey)}
      onTogglePin={() =>
        setPinnedKeys((keys) => toggleDraftProjectPin(keys, entry.group.projectKey))
      }
    />
  );

  return (
    <Combobox
      items={items}
      filteredItems={items}
      filter={null}
      autoHighlight
      value={choices.value === "" ? null : choices.value}
      onValueChange={(value) => {
        if (typeof value === "string") choices.pick(value);
      }}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
      {props.children}
      <ComboboxPopup
        align="start"
        side="top"
        data-fork-glass-rim
        data-fork-chip-menu=""
        className="w-72"
      >
        <ComboboxSearchInput
          aria-label="Search projects"
          placeholder="Search projects"
          value={query}
          ref={searchRef}
          onChange={(event) => setQuery(event.target.value)}
          endAddon={
            <DraftProjectSortMenu sort={sort} onSortChange={setSort} returnFocusTo={searchRef} />
          }
        />
        <ComboboxEmpty>No projects found.</ComboboxEmpty>
        <ComboboxList className="max-h-80">
          {showNoProject ? (
            <ComboboxItem hideIndicator index={0} value={NO_PROJECT_VALUE}>
              <MessageSquareDashedIcon className="size-4 shrink-0 dark:text-white/40" />
              <span className="min-w-0 truncate">No project</span>
            </ComboboxItem>
          ) : null}
          {pinned.map(projectRow)}
          {pinned.length > 0 && rest.length > 0 ? (
            // Full width: the list pads its rows by 4px a side.
            <Separator className="-mx-1 my-1 w-auto" />
          ) : null}
          {rest.map(projectRow)}
        </ComboboxList>
        <Separator />
        <div className="p-1">
          <Button
            type="button"
            size="xs"
            variant="ghost-muted"
            onClick={() => {
              setOpen(false);
              setQuery("");
              openAddProject();
            }}
          >
            <FolderPlusIcon />
            Add a project
          </Button>
        </div>
      </ComboboxPopup>
    </Combobox>
  );
}

const SORT_LABELS: Record<DraftProjectSort, string> = { recent: "Recent", name: "Name" };

function DraftProjectSortMenu(props: {
  readonly sort: DraftProjectSort;
  readonly onSortChange: (sort: DraftProjectSort) => void;
  /** Back to the search on close, so typing still filters. */
  readonly returnFocusTo: RefObject<HTMLInputElement | null>;
}) {
  const label = `Sort projects: ${SORT_LABELS[props.sort]}`;
  return (
    <Menu modal={false}>
      <Tooltip>
        <TooltipTrigger
          render={
            <MenuTrigger
              render={
                <Button type="button" size="icon-xs" variant="ghost-muted" aria-label={label} />
              }
            />
          }
        >
          <ArrowUpDownIcon weight="stroke" />
        </TooltipTrigger>
        <TooltipPopup side="top">{label}</TooltipPopup>
      </Tooltip>
      <MenuPopup
        align="end"
        data-fork-glass-rim
        className="min-w-36"
        finalFocus={props.returnFocusTo}
      >
        <MenuRadioGroup
          value={props.sort}
          onValueChange={(value) => {
            if (value === "recent" || value === "name") props.onSortChange(value);
          }}
        >
          {(["recent", "name"] as const).map((sort) => (
            <MenuRadioItem key={sort} value={sort} closeOnClick>
              {SORT_LABELS[sort]}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuPopup>
    </Menu>
  );
}

function DraftProjectRow(props: {
  readonly entry: DraftProjectMenuChoices["entries"][number];
  readonly index: number;
  readonly pinned: boolean;
  readonly onTogglePin: () => void;
}) {
  const { entry, pinned } = props;
  const label = pinned ? "Unpin project" : "Pin project";
  return (
    <ComboboxItem
      hideIndicator
      index={props.index}
      value={entry.group.projectKey}
      className="group"
    >
      <ProjectFavicon
        project={entry.targetProject}
        className="size-4 shrink-0"
        fallbackIcon={PickerFolderIcon}
      />
      <span className="min-w-0 flex-1 truncate">{entry.group.displayName}</span>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              size="icon-xs"
              variant="ghost-muted"
              aria-label={label}
              aria-pressed={pinned}
              // The row would take the click as a pick.
              onClick={(event) => {
                event.stopPropagation();
                props.onTogglePin();
              }}
              onMouseDown={(event) => event.preventDefault()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <PinIcon
                weight={pinned ? "fill" : "stroke"}
                className={cn(
                  "size-3.5",
                  !pinned &&
                    "opacity-0 group-hover:opacity-100 group-data-highlighted:opacity-100 in-focus-visible:opacity-100 pointer-coarse:opacity-100",
                )}
              />
            </Button>
          }
        />
        <TooltipPopup side="top">{label}</TooltipPopup>
      </Tooltip>
    </ComboboxItem>
  );
}
