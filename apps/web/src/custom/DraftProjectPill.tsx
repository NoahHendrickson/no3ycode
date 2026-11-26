/** A draft's project chip, first in the composer's context row and painted like
    its neighbours by the row's CSS ([data-fork-composer-context-row]). An
    unassigned draft's reads "Choose a project". See `.fork/customizations.yaml#fork-new-agent-draft`. */
import { useLayoutEffect, useRef, type ReactNode } from "react";

import { Button } from "~/components/ui/button";
import { Menu, MenuTrigger } from "~/components/ui/menu";
import type { DraftId } from "~/composerDraftStore";
import { DraftProjectMenuPopup } from "./DraftProjectMenuPopup";
import { playDraftProjectPick } from "./draftProjectPickMotion";
import { FolderIcon, FolderPlusIcon, MessageSquareDashedIcon } from "./icons/lucide-hugeicons";
import {
  openAddProject,
  useDraftProjectChoices,
  type DraftProjectChoices,
} from "./useDraftProjectChoices";

/** The branch chip's dress on a ghost Button; the row's CSS owns the chip fill. */
const DRAFT_PROJECT_CHIP_CLASS_NAME =
  // oxlint-disable-next-line shadcn/no-restyle -- the composer context strip's muted chip label, which only this chip wears
  "font-normal text-muted-foreground/70 hover:text-foreground/80 min-w-0 max-w-72 active:scale-100";

/** Upstream's collapsing chip label: hidden with its siblings when the strip overflows. */
function DraftProjectChipLabel({ children }: { readonly children: ReactNode }) {
  return (
    <span
      data-composer-label
      className="min-w-0 max-w-60 group-data-[compact]/composer-context:max-w-0"
    >
      <span
        data-composer-label-motion
        className="block w-full min-w-0 max-w-60 truncate transition-opacity duration-180 ease-drawer group-data-[compact]/composer-context:opacity-0 motion-reduce:transition-none"
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
        <FolderPlusIcon className="size-3 shrink-0 text-current" />
        <DraftProjectChipLabel>Add a project</DraftProjectChipLabel>
      </Button>
    );
  }
  return <DraftProjectChip choices={choices} draftId={props.draftId} />;
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
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- slides a remounted chip in from the picked row, reading both boxes before paint
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
          <MessageSquareDashedIcon className="size-3 shrink-0 text-current" />
        ) : (
          <FolderIcon className="size-3 shrink-0 text-current" />
        )}
        <DraftProjectChipLabel>{label}</DraftProjectChipLabel>
      </MenuTrigger>
      <DraftProjectMenuPopup choices={props.choices} />
    </Menu>
  );
}
