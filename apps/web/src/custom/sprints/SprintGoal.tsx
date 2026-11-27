/**
 * A sprint's Goal tab — see `.fork/customizations.yaml#fork-sprints`. The goal is the first
 * `Goal:` line of PLAN.md, and the model its threads run on its `Thread model:` line. A save reads
 * the file fresh and rewrites only that line, so the sprint's own changes to the rest of the plan
 * stay, and tells the sprint on its next message.
 */
import type { EnvironmentId, ModelSelection, ProjectId, ScopedThreadRef } from "@t3tools/contracts";
import { useState } from "react";

import { scheduledTaskDefaultModel } from "~/components/settings/scheduledTasksSettings.logic";
import { Button } from "~/components/ui/button";
import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { useQuietThreadShell } from "~/state/entities";

import {
  NoSprintFileAccess,
  type SprintFileLens,
  SprintFileFooter,
  useSprintFile,
} from "./SprintFileEditor";
import { SprintModelPicker } from "./SprintModelPicker";
import {
  parseSprintGoal,
  parseSprintThreadModel,
  SPRINT_PLAN_FILE,
  withSprintGoal,
  withSprintThreadModel,
} from "./sprintThreads";
import { useSprintModelChoices } from "./useSprintModelChoices";

/** PLAN.md's goal line: the editor shows the goal alone. */
const GOAL_LENS: SprintFileLens = {
  read: (plan) => parseSprintGoal(plan) ?? "",
  write: withSprintGoal,
};

export function SprintGoal(props: {
  readonly sprintRef: ScopedThreadRef;
  readonly folder: string;
}) {
  const { environmentId } = props.sprintRef;
  // Read again whenever one of the sprint's runs starts or ends, since the sprint rewrites PLAN.md.
  const plan = useSprintFile(props.sprintRef, props.folder, SPRINT_PLAN_FILE, GOAL_LENS);
  const [pendingModel, setPendingModel] = useState<ModelSelection | null>(null);
  const projectId = useQuietThreadShell(props.sprintRef)?.projectId ?? null;
  const { view } = plan;

  const save = async () => {
    if (!view.dirty || plan.saving) return;
    if (await plan.save(view.value.replace(/\s+/g, " ").trim(), true)) return;
    toastManager.add(
      stackedThreadToast({
        type: "error",
        title: "Could not save the goal",
        description: "Your change is still here. Try again.",
      }),
    );
  };

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

  if (!plan.canReadFiles) return <NoSprintFileAccess />;
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-fork-sprint-goal="">
      {projectId === null || plan.contents === null ? null : (
        <SprintThreadModelRow
          environmentId={environmentId}
          projectId={projectId}
          selection={pendingModel ?? parseSprintThreadModel(plan.contents)}
          disabled={pendingModel !== null}
          onChange={(selection) => void saveThreadModel(selection)}
        />
      )}
      <p className="shrink-0 px-3.5 pt-2.5 text-xs text-muted-foreground">
        What this sprint works toward. It plans toward the goal and tells you once it looks met.
        Change it whenever the work changes.
      </p>
      <textarea
        aria-label="Goal"
        className="min-h-0 flex-1 resize-none bg-transparent px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        value={view.value}
        placeholder={
          plan.disk === null
            ? ""
            : "No goal yet. For example: Redesign the composer for Flat Glass."
        }
        readOnly={plan.disk === null}
        onChange={(event) => plan.edit(event.target.value)}
        onKeyDown={(event) => {
          // One line in PLAN.md, so Enter saves rather than breaking it; not while an IME composes.
          if (
            (event.key === "Enter" && !event.nativeEvent.isComposing) ||
            ((event.metaKey || event.ctrlKey) && event.key === "s")
          ) {
            event.preventDefault();
            void save();
          }
        }}
        data-testid="sprint-goal-editor"
      />
      <SprintFileFooter
        view={view}
        saving={plan.saving}
        staleNote="The sprint changed the goal since you began. Saving replaces its change."
        onSave={() => void save()}
        onDiscard={plan.discard}
        saveTestId="sprint-goal-save"
      />
    </div>
  );
}

/** The model the sprint passes to each thread it starts, PLAN.md's `Thread model:` line. Unset, it
    shows the owner's default for the project, which one click writes. */
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
        {props.selection === null ? "Threads run on: not set" : "Threads run on"}
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
