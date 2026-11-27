/**
 * The model a sprint's new threads run on, an icon button beside the Threads tab's search — see
 * `.fork/customizations.yaml#fork-sprints`. It is PLAN.md's `Thread model:` line: a change reads
 * the file fresh, rewrites only that line, and tells the sprint on its next message.
 */
import type { EnvironmentId, ModelSelection, ProjectId, ScopedThreadRef } from "@t3tools/contracts";
import { useState } from "react";

import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { useQuietThreadShell } from "~/state/entities";

import { useSprintFile } from "./SprintFileEditor";
import { SprintModelPicker } from "./SprintModelPicker";
import { parseSprintThreadModel, SPRINT_PLAN_FILE, withSprintThreadModel } from "./sprintThreads";
import { useSprintModelChoices } from "./useSprintModelChoices";

const LABEL = "Model for new threads";

export function SprintThreadModel(props: { readonly sprintRef: ScopedThreadRef }) {
  const shell = useQuietThreadShell(props.sprintRef);
  if (shell === null || shell.worktreePath === null || shell.projectId === null) return null;
  return (
    <SprintThreadModelFromPlan
      sprintRef={props.sprintRef}
      folder={shell.worktreePath}
      projectId={shell.projectId}
      sprintModel={shell.modelSelection}
    />
  );
}

function SprintThreadModelFromPlan(props: {
  readonly sprintRef: ScopedThreadRef;
  readonly folder: string;
  readonly projectId: ProjectId;
  readonly sprintModel: ModelSelection;
}) {
  const plan = useSprintFile(props.sprintRef, props.folder, SPRINT_PLAN_FILE);
  const [pendingModel, setPendingModel] = useState<ModelSelection | null>(null);

  const saveThreadModel = async (selection: ModelSelection) => {
    setPendingModel(selection);
    const written = await plan.rewrite((current) => withSprintThreadModel(current, selection));
    setPendingModel(null);
    if (written) return;
    toastManager.add(
      stackedThreadToast({
        type: "error",
        title: "Could not save the thread model",
        description: "PLAN.md was not changed. Try again.",
      }),
    );
  };

  if (!plan.canReadFiles || plan.contents === null) return null;
  return (
    <SprintThreadModelButton
      environmentId={props.sprintRef.environmentId}
      projectId={props.projectId}
      // Without a Thread model line a thread runs on the sprint's own model, so that is shown.
      selection={pendingModel ?? parseSprintThreadModel(plan.contents) ?? props.sprintModel}
      disabled={pendingModel !== null}
      onChange={(selection) => void saveThreadModel(selection)}
    />
  );
}

function SprintThreadModelButton(props: {
  readonly environmentId: EnvironmentId;
  readonly projectId: ProjectId;
  readonly selection: ModelSelection;
  readonly disabled: boolean;
  readonly onChange: (selection: ModelSelection) => void;
}) {
  const { instanceEntries, modelOptionsByInstance } = useSprintModelChoices(
    props.environmentId,
    props.projectId,
    () => props.selection,
  );
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="flex shrink-0" data-testid="sprint-thread-model" />}>
        <SprintModelPicker
          environmentId={props.environmentId}
          instanceEntries={instanceEntries}
          modelOptionsByInstance={modelOptionsByInstance}
          selection={props.selection}
          disabled={props.disabled}
          onChange={props.onChange}
          iconLabel={LABEL}
        />
      </TooltipTrigger>
      <TooltipPopup side="bottom">{LABEL}</TooltipPopup>
    </Tooltip>
  );
}
