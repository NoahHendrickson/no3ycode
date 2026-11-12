/** The draft's full project menu, opened from the project chip or the quick
    picks' chevron — see `.fork/customizations.yaml#fork-new-agent-draft`. */
import { ProjectFavicon } from "~/components/ProjectFavicon";
import {
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
} from "~/components/ui/menu";
import { cn } from "~/lib/utils";
import { FolderIcon, FolderPlusIcon, MessageSquareDashedIcon } from "./icons/lucide-phosphor";
import {
  NO_PROJECT_VALUE,
  openAddProject,
  type DraftProjectMenuChoices,
} from "./useDraftProjectChoices";

/** A favicon-less project's folder: white at low opacity tints with the dark
    glass popup; the light popup keeps upstream's muted token. */
function PickerFolderIcon(props: { readonly className?: string | undefined }) {
  return <FolderIcon className={cn(props.className, "dark:text-white/40")} />;
}

const ROW_CLASS_NAME =
  "[&>span:last-child]:flex [&>span:last-child]:min-w-0 [&>span:last-child]:items-center [&>span:last-child]:gap-2";

export function DraftProjectMenuPopup(props: { readonly choices: DraftProjectMenuChoices }) {
  const { choices } = props;
  return (
    <MenuPopup
      align="start"
      side="top"
      data-fork-glass-rim
      data-fork-chip-menu=""
      // The popup caps the height and MenuPopup's own list scrolls inside
      // it. Scrolling the popup itself would carry its glass rim
      // (theme.custom.glass-surfaces.css) away with the rows.
      className="max-h-80 min-w-48! w-max max-w-72"
    >
      <MenuRadioGroup
        value={choices.value}
        onValueChange={(value) => {
          if (typeof value === "string") choices.pick(value);
        }}
      >
        {choices.noProjectEnvironmentId !== null ? (
          <MenuRadioItem value={NO_PROJECT_VALUE} closeOnClick className={ROW_CLASS_NAME}>
            <MessageSquareDashedIcon className="size-4 shrink-0 dark:text-white/40" />
            <span className="min-w-0 truncate">No project</span>
          </MenuRadioItem>
        ) : null}
        {choices.entries.map(({ group, targetProject }) => (
          <MenuRadioItem
            key={group.projectKey}
            value={group.projectKey}
            closeOnClick
            className={ROW_CLASS_NAME}
          >
            <ProjectFavicon
              project={targetProject}
              className="size-4 shrink-0"
              fallbackIcon={PickerFolderIcon}
            />
            <span className="min-w-0 truncate">{group.displayName}</span>
          </MenuRadioItem>
        ))}
      </MenuRadioGroup>
      <MenuSeparator />
      <MenuItem onClick={openAddProject}>
        <FolderPlusIcon />
        Add a project
      </MenuItem>
    </MenuPopup>
  );
}
