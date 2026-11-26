/** The draft's project picker, opened from the project chip: search, pinned projects first,
    sorted by recent use or name — see `.fork/customizations.yaml#fork-new-agent-draft`. */
import { useAtomValue } from "@effect/atom-react";
import * as Schema from "effect/Schema";
import { type ReactNode, type RefObject, useRef, useState } from "react";

import { isProjectPinShortcut, ProjectPinButton } from "~/components/ProjectPinButton";
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
import { useOrderWhileOpen } from "~/hooks/useOrderWhileOpen";
import { shortcutLabelForCommand } from "~/keybindings";
import { cn } from "~/lib/utils";
import { primaryServerKeybindingsAtom } from "~/state/server";
import {
  DRAFT_PROJECT_SORTS,
  type DraftProjectSort,
  matchesDraftProjectQuery,
  orderDraftProjectEntries,
} from "./draftProjectPicker.logic";
import {
  ArrowUpDownIcon,
  FolderIcon,
  FolderPlusIcon,
  MessageSquareDashedIcon,
} from "./icons/lucide-hugeicons";
import {
  NO_PROJECT_VALUE,
  openAddProject,
  type DraftProjectMenuChoices,
} from "./useDraftProjectChoices";

// Device-local, like the sidebar's grouping switches: a contracts field would put a
// fork-shaped key in a schema upstream owns.
const SORT_STORAGE_KEY = "t3code:fork:draft-project-sort:v1";
const SortSchema = Schema.Literals(DRAFT_PROJECT_SORTS);
const isDraftProjectSort = Schema.is(SortSchema);
const SORT_LABELS: Record<DraftProjectSort, string> = { recent: "Recent", name: "Name" };
const DEFAULT_SORT: DraftProjectSort = "recent";

type PickerEntry = DraftProjectMenuChoices["entries"][number];
type PickerRow =
  | { readonly value: typeof NO_PROJECT_VALUE; readonly label: string; readonly entry: null }
  | { readonly value: string; readonly label: string; readonly entry: PickerEntry };

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
  const highlightedRef = useRef<string | null>(null);
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const [sort, setSort] = useLocalStorage(SORT_STORAGE_KEY, DEFAULT_SORT, SortSchema);
  const close = () => {
    setOpen(false);
    setQuery("");
  };

  // Rows hold the order they opened with, so a pin or new activity never moves a row under
  // the highlight; keying by sort lets a new sort reorder the open list at once.
  const rows = useOrderWhileOpen<PickerRow>(
    [
      ...(choices.noProjectEnvironmentId !== null
        ? [{ value: NO_PROJECT_VALUE, label: "No project", entry: null } as const]
        : []),
      ...orderDraftProjectEntries(choices.entries, sort, choices.recentKeys).map((entry) => ({
        value: entry.group.projectKey,
        label: entry.group.displayName,
        entry,
      })),
    ],
    (row) => `${sort}:${row.value}`,
    open,
  ).filter((row) => matchesDraftProjectQuery(row.label, query));
  const items = rows.map((row) => row.value);
  const entryByValue = new Map(rows.flatMap((row) => (row.entry ? [[row.value, row.entry]] : [])));

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
      onItemHighlighted={(value) => {
        highlightedRef.current = typeof value === "string" ? value : null;
      }}
      open={open}
      onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : close())}
    >
      {props.children}
      <ComboboxPopup
        align="start"
        side="top"
        data-fork-glass-rim
        data-fork-chip-menu=""
        className="w-72"
        // On touch, focusing the search raises the on-screen keyboard over the list.
        initialFocus={(openType) => openType !== "touch"}
      >
        <ComboboxSearchInput
          aria-label="Search projects"
          placeholder="Search projects"
          value={query}
          ref={searchRef}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            const entry = highlightedRef.current ? entryByValue.get(highlightedRef.current) : null;
            if (!entry || !choices.canPin(entry.group)) return;
            if (!isProjectPinShortcut(event, keybindings)) return;
            event.preventDefault();
            event.stopPropagation();
            choices.togglePin(entry.group);
          }}
          endAddon={
            <DraftProjectSortMenu sort={sort} onSortChange={setSort} returnFocusTo={searchRef} />
          }
        />
        <ComboboxEmpty>No projects found.</ComboboxEmpty>
        <ComboboxList className="max-h-80">
          {rows.map((row, index) => (
            <ComboboxItem key={row.value} hideIndicator index={index} value={row.value}>
              {row.entry === null ? (
                <MessageSquareDashedIcon className="size-4 shrink-0 dark:text-white/40" />
              ) : (
                <ProjectFavicon
                  project={row.entry.targetProject}
                  className="size-4 shrink-0"
                  fallbackIcon={PickerFolderIcon}
                />
              )}
              <span className="min-w-0 flex-1 truncate">{row.label}</span>
              {row.entry !== null && choices.canPin(row.entry.group) ? (
                <ProjectPinButton
                  name={row.label}
                  pinned={row.entry.group.pinned}
                  shortcutLabel={shortcutLabelForCommand(keybindings, "thread.pin")}
                  onToggle={() => row.entry && choices.togglePin(row.entry.group)}
                />
              ) : null}
            </ComboboxItem>
          ))}
        </ComboboxList>
        <Separator />
        <div className="p-1">
          <Button
            type="button"
            size="xs"
            variant="ghost-muted"
            onClick={() => {
              close();
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
            if (isDraftProjectSort(value)) props.onSortChange(value);
          }}
        >
          {DRAFT_PROJECT_SORTS.map((sort) => (
            <MenuRadioItem key={sort} value={sort} closeOnClick>
              {SORT_LABELS[sort]}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuPopup>
    </Menu>
  );
}
