/** A draft's project chip, first in the composer's context row and painted like
    its neighbours by the row's CSS ([data-fork-composer-context-row]). An
    unassigned draft's reads "Choose a project". See `.fork/customizations.yaml#fork-new-agent-draft`. */
import { type ReactNode, type Ref, useLayoutEffect, useRef } from "react";

import { Button } from "~/components/ui/button";
import { ComboboxTrigger } from "~/components/ui/combobox";
import type { DraftId } from "~/composerDraftStore";
import { DraftProjectPicker } from "./DraftProjectMenuPopup";
import { playDraftProjectPick } from "./draftProjectPickMotion";
import { FolderIcon, FolderPlusIcon, MessageSquareDashedIcon } from "./icons/lucide-hugeicons";
import {
  openAddProject,
  useDraftProjectChoices,
  type DraftProjectChoices,
  type DraftProjectMenuChoices,
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
    return <DraftAddProjectButton onAdd={openAddProject} />;
  }
  return <DraftProjectChip choices={choices} draftId={props.draftId} />;
}

function DraftProjectChip(props: {
  readonly choices: DraftProjectChoices;
  readonly draftId: DraftId | null;
}) {
  const chipRef = useRef<HTMLButtonElement>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- slides a remounted chip in from the picked row, reading both boxes before paint
  useLayoutEffect(() => {
    if (props.draftId !== null && chipRef.current) {
      playDraftProjectPick(props.draftId, chipRef.current);
    }
  }, [props.draftId]);
  return <DraftProjectPillView ref={chipRef} choices={props.choices} />;
}

/** What the chip reads: the menu's rows and pick, the selection it names, and whether a pick is
    still landing. */
export type DraftProjectPillViewChoices = DraftProjectMenuChoices & {
  readonly selection:
    | { readonly kind: "unassigned" | "no-project" }
    | { readonly kind: "project"; readonly label: string };
  readonly pending: boolean;
};

/** @public — the chip in a pill's place when there is no project to pick; Storybook renders it. */
export function DraftAddProjectButton({ onAdd }: { readonly onAdd: () => void }) {
  return (
    <Button
      type="button"
      size="xs"
      variant="ghost"
      className={DRAFT_PROJECT_CHIP_CLASS_NAME}
      onClick={onAdd}
      data-testid="draft-project-pill"
      data-composer-context-control
    >
      <FolderPlusIcon className="size-3 shrink-0 text-current" />
      <DraftProjectChipLabel>Add a project</DraftProjectChipLabel>
    </Button>
  );
}

/** @public — the pill as drawn; Storybook renders it on its own. */
export function DraftProjectPillView({
  choices,
  ref,
}: {
  readonly choices: DraftProjectPillViewChoices;
  readonly ref?: Ref<HTMLButtonElement> | undefined;
}) {
  const { selection, pending } = choices;
  const label =
    selection.kind === "no-project"
      ? "No project"
      : selection.kind === "project"
        ? selection.label
        : "Choose a project";
  return (
    <DraftProjectPicker choices={choices}>
      <ComboboxTrigger
        ref={ref}
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
      </ComboboxTrigger>
    </DraftProjectPicker>
  );
}
