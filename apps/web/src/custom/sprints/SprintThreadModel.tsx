/**
 * The model a sprint's new threads run on, at the top of its Threads tab — see
 * `.fork/customizations.yaml#fork-sprints`. It is PLAN.md's `Thread model:` line: a change reads the
 * file fresh, rewrites only that line, and tells the sprint on its next message.
 */
import type { EnvironmentId, ModelSelection, ProjectId, ScopedThreadRef } from "@t3tools/contracts";
import { useState } from "react";

import { scheduledTaskDefaultModel } from "~/components/settings/scheduledTasksSettings.logic";
import { Button } from "~/components/ui/button";
import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { useQuietThreadShell } from "~/state/entities";

import { useSprintFile } from "./SprintFileEditor";
import { SprintModelPicker } from "./SprintModelPicker";
import { parseSprintThreadModel, SPRINT_PLAN_FILE, withSprintThreadModel } from "./sprintThreads";
import { useSprintModelChoices } from "./useSprintModelChoices";

export function SprintThreadModel(props: { readonly sprintRef: ScopedThreadRef }) {
  const shell = useQuietThreadShell(props.sprintRef);
  const folder = shell?.worktreePath ?? null;
  const projectId = shell?.projectId ?? null;
  if (folder === null || projectId === null) return null;
  return (
    <SprintThreadModelFromPlan sprintRef={props.sprintRef} folder={folder} projectId={projectId} />
  );
}

function SprintThreadModelFromPlan(props: {
  readonly sprintRef: ScopedThreadRef;
  readonly folder: string;
  readonly projectId: ProjectId;
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
    <SprintThreadModelRow
      environmentId={props.sprintRef.environmentId}
      projectId={props.projectId}
      selection={pendingModel ?? parseSprintThreadModel(plan.contents)}
      disabled={pendingModel !== null}
      onChange={(selection) => void saveThreadModel(selection)}
    />
  );
}

/** Unset, it shows the owner's default for the project, which one click writes. */
function SprintThreadModelRow(props: {
  readonly environmentId: EnvironmentId;
  readonly projectId: ProjectId;
  readonly selection: ModelSelection | null;
  readonly disabled: boolean;
  readonly onChange: (selection: ModelSelection) => void;
}) {
  const {
    instanceEntries,
    selection: shown,
    modelOptionsByInstance,
  } = useSprintModelChoices(
    props.environmentId,
    props.projectId,
    ({ settings, project, instanceEntries: entries }) =>
      props.selection ??
      (project === undefined ? null : scheduledTaskDefaultModel(settings, project, entries)),
  );
  return (
    <div
      className="flex shrink-0 items-center gap-2 border-b border-border px-3.5 py-2"
      data-testid="sprint-thread-model"
    >
      <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
        {props.selection === null ? "New threads: not set" : "New threads"}
      </p>
      {shown === null ? (
        <p className="text-xs text-muted-foreground">Sign in to a provider in Settings first.</p>
      ) : (
        <>
          <SprintModelPicker
            environmentId={props.environmentId}
            instanceEntries={instanceEntries}
            modelOptionsByInstance={modelOptionsByInstance}
            selection={shown}
            disabled={props.disabled}
            onChange={props.onChange}
          />
          {props.selection === null ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={props.disabled}
              onClick={() => props.onChange(shown)}
            >
              Use this
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
