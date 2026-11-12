/** A draft's project chip, first in the composer's context row and painted like
    its neighbours by the row's CSS ([data-fork-composer-context-row]); an
    unassigned draft gets the quick picks instead. See
    `.fork/customizations.yaml#fork-new-agent-draft`. */
import { useLayoutEffect, useRef, type ReactNode } from "react";

import { ProjectFavicon } from "~/components/ProjectFavicon";
import { Button } from "~/components/ui/button";
import { Menu, MenuTrigger } from "~/components/ui/menu";
import type { DraftId } from "~/composerDraftStore";
import { DraftProjectMenuPopup } from "./DraftProjectMenuPopup";
import { DraftProjectQuickPicks } from "./DraftProjectQuickPicks";
import { playDraftProjectPick } from "./draftProjectPickMotion";
import {
  ChevronDownIcon,
  FolderIcon,
  FolderPlusIcon,
  MessageSquareDashedIcon,
} from "./icons/lucide-phosphor";
import {
  openAddProject,
  useDraftProjectChoices,
  type DraftProjectChoices,
} from "./useDraftProjectChoices";

/** Same trigger dress as the branch chip; the row's CSS owns the chip fill. */
const DRAFT_PROJECT_CHIP_CLASS_NAME =
  "min-w-0 max-w-72 font-normal text-muted-foreground/70 text-xs! hover:text-foreground/80 active:scale-100";

/** Upstream's collapsing chip label: hidden with its siblings when the strip overflows. */
function DraftProjectChipLabel({ children }: { readonly children: ReactNode }) {
  return (
    <span
      data-composer-label
      className="min-w-0 max-w-[240px] group-data-[compact]/composer-context:max-w-0"
    >
      <span
        data-composer-label-motion
        className="block w-full min-w-0 max-w-[240px] truncate transition-opacity duration-180 ease-[cubic-bezier(0.32,0.72,0,1)] group-data-[compact]/composer-context:opacity-0 motion-reduce:transition-none"
      >
        {children}
      </span>
    </span>
  );
}

export function DraftProjectPill(props: Parameters<typeof useDraftProjectChoices>[0]) {
  const choices = useDraftProjectChoices(props);
  if (choices.entries.length === 0 && choices.noProjectEnvironmentId === null) {
    return (
      <Button
        type="button"
        size="xs"
        variant="ghost"
        className={DRAFT_PROJECT_CHIP_CLASS_NAME}
        onClick={openAddProject}
        data-testid="draft-project-pill"
        data-composer-context-control
      >
        <FolderPlusIcon className="size-3 shrink-0" />
        <DraftProjectChipLabel>Add a project</DraftProjectChipLabel>
      </Button>
    );
  }
  return choices.recentEntries !== null ? (
    <DraftProjectQuickPicks choices={choices} recentEntries={choices.recentEntries} />
  ) : (
    <DraftProjectChip choices={choices} draftId={props.draftId} />
  );
}

function DraftProjectChip(props: {
  readonly choices: DraftProjectChoices;
  readonly draftId: DraftId | null;
}) {
  const { selection, pending } = props.choices;
  const label =
    selection.kind === "no-project"
      ? "No project"
      : selection.kind === "project"
        ? selection.label
        : "Choose a project";
  const chipRef = useRef<HTMLButtonElement>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- slides a newly mounted chip in from the picked pill, reading both boxes before paint
  useLayoutEffect(() => {
    if (props.draftId !== null && chipRef.current) {
      playDraftProjectPick(props.draftId, chipRef.current);
    }
  }, [props.draftId]);
  return (
    <Menu>
      <MenuTrigger
        ref={chipRef}
        render={
          <Button
            type="button"
            size="xs"
            variant="ghost"
            aria-label={selection.kind === "unassigned" ? label : `Change project — ${label}`}
            // No press-scale, like the branch chip: the popup aligns live to
            // this trigger and a momentary shrink drags it sideways.
            className={DRAFT_PROJECT_CHIP_CLASS_NAME}
            data-testid="draft-project-pill"
            data-fork-draft-project-chip=""
            data-composer-context-control
            data-project-assigned={selection.kind === "unassigned" ? "false" : "true"}
            aria-busy={pending || undefined}
          />
        }
      >
        {selection.kind === "no-project" ? (
          <MessageSquareDashedIcon className="size-3 shrink-0" />
        ) : selection.kind === "project" && selection.entry ? (
          <ProjectFavicon
            project={selection.entry.targetProject}
            className="size-3 shrink-0"
            fallbackIcon={FolderIcon}
          />
        ) : (
          <FolderIcon className="size-3 shrink-0" />
        )}
        <DraftProjectChipLabel>{label}</DraftProjectChipLabel>
        <ChevronDownIcon className="size-3 shrink-0 opacity-50" />
      </MenuTrigger>
      <DraftProjectMenuPopup choices={props.choices} />
    </Menu>
  );
}
