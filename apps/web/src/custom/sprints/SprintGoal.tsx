/**
 * A sprint's Goal tab — see `.fork/customizations.yaml#fork-sprints`. The goal is the first
 * `Goal:` line of PLAN.md, and the model its threads run on its `Thread model:` line. A save reads
 * the file fresh and rewrites only that line, so the sprint's own changes to the rest of the plan
 * stay, and tells the sprint on its next message.
 */
import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import { executeAtomQuery, runAtomCommand } from "@t3tools/client-runtime/state/runtime";
import type {
  EnvironmentId,
  ModelSelection,
  ProjectId,
  ProjectReadFileResult,
  ScopedThreadRef,
} from "@t3tools/contracts";
import { AsyncResult, Atom } from "effect/reactivity";
import { useContext, useState } from "react";

import { scheduledTaskDefaultModel } from "~/components/settings/scheduledTasksSettings.logic";
import { Button } from "~/components/ui/button";
import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { useEnvironmentSettings } from "~/hooks/useSettings";
import { getCustomModelOptionsByInstance } from "~/modelSelection";
import { providerInstanceEntriesFor } from "~/providerInstances";
import { useProjects, useQuietThreadShell } from "~/state/entities";
import { useFilesystemReadAccess } from "~/state/filesystem";
import { projectEnvironment } from "~/state/projects";
import { revisionedQuery } from "~/state/revisionedQuery";
import { EMPTY_SERVER_PROVIDERS, serverEnvironment } from "~/state/server";

import { useBotDigestConversation } from "../bots/useAnsweredBotDigestAsks";
import {
  nextSprintFileDraft,
  type SprintFileDraft,
  sprintFileEditorView,
} from "./sprintFileEditor.logic";
import { withoutPromptInjectedLevels } from "./sprintModel";
import { SprintModelPicker } from "./SprintModelPicker";
import {
  parseSprintGoal,
  parseSprintThreadModel,
  SPRINT_OWNER_EDITS_DIRECTORY,
  SPRINT_PLAN_FILE,
  withSprintGoal,
  withSprintThreadModel,
} from "./sprintThreads";

const NO_PLAN = Atom.make(AsyncResult.initial<ProjectReadFileResult, never>(false)).pipe(
  Atom.withLabel("sprint-plan:none"),
);

const QUIET = { reportFailure: false, reportDefect: true } as const;

/** The owner-edit marker's contents; out of the component, since it reads the clock. */
const ownerEditStamp = () => `${new Date().toISOString()}\n`;

export function SprintGoal(props: {
  readonly sprintRef: ScopedThreadRef;
  readonly folder: string;
}) {
  const { environmentId } = props.sprintRef;
  const registry = useContext(RegistryContext);
  const { canReadFiles } = useFilesystemReadAccess(environmentId);
  // Read again whenever one of the sprint's runs starts or ends, since the sprint rewrites PLAN.md.
  const conversation = useBotDigestConversation(scopedThreadKey(props.sprintRef));
  const [revision, setRevision] = useState(0);
  const [draft, setDraft] = useState<SprintFileDraft | null>(null);
  const [saved, setSaved] = useState<{ readonly text: string; readonly key: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingModel, setPendingModel] = useState<ModelSelection | null>(null);
  const projectId = useQuietThreadShell(props.sprintRef)?.projectId ?? null;
  const input = { cwd: props.folder, relativePath: SPRINT_PLAN_FILE, allowMissing: true };
  const query = canReadFiles ? projectEnvironment.readFile({ environmentId, input }) : NO_PLAN;
  const readKey = (local: number) => `${conversation?.revision ?? ""}:${local}`;
  const result = useAtomValue(revisionedQuery(query, readKey(revision)));
  const file = AsyncResult.getOrElse(result, () => null);
  const plan = file === null ? null : file.exists === false ? "" : file.contents;
  const disk = plan === null ? null : (parseSprintGoal(plan) ?? "");
  const view = sprintFileEditorView({
    disk,
    draft,
    saved: saved?.key === readKey(revision) ? saved.text : null,
    reading: result.waiting,
  });

  /** Rewrites PLAN.md from a fresh read and drops the owner-edit marker; false when it failed. */
  const writePlan = async (change: (plan: string) => string): Promise<boolean> => {
    const fresh = await executeAtomQuery(
      registry,
      projectEnvironment.readFile({ environmentId, input }),
      { ...QUIET, refresh: true },
    );
    const current =
      fresh._tag !== "Success" ? null : fresh.value.exists === false ? "" : fresh.value.contents;
    const write = (relativePath: string, contents: string) =>
      runAtomCommand(
        registry,
        projectEnvironment.writeFile,
        { environmentId, input: { cwd: props.folder, relativePath, contents } },
        { label: projectEnvironment.writeFile.label, ...QUIET },
      );
    const written =
      current === null || (fresh._tag === "Success" && fresh.value.truncated)
        ? null
        : await write(SPRINT_PLAN_FILE, change(current));
    if (written?._tag !== "Success") return false;
    await write(`${SPRINT_OWNER_EDITS_DIRECTORY}/${SPRINT_PLAN_FILE}`, ownerEditStamp());
    return true;
  };

  const save = async () => {
    if (!view.dirty || saving) return;
    const goal = view.value.replace(/\s+/g, " ").trim();
    setSaving(true);
    const written = await writePlan((current) => withSprintGoal(current, goal));
    setSaving(false);
    if (!written) {
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "Could not save the goal",
          description: "Your change is still here. Try again.",
        }),
      );
      return;
    }
    setSaved({ text: goal, key: readKey(revision + 1) });
    setDraft(null);
    setRevision((current) => current + 1);
  };

  const saveThreadModel = async (selection: ModelSelection) => {
    setPendingModel(selection);
    const written = await writePlan((current) => withSprintThreadModel(current, selection));
    setPendingModel(null);
    if (!written) {
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "Could not save the thread model",
          description: "PLAN.md was not changed. Try again.",
        }),
      );
      return;
    }
    setRevision((current) => current + 1);
  };

  if (!canReadFiles) {
    return (
      <p className="px-3.5 py-3 text-sm text-muted-foreground">
        This machine does not let you read files.
      </p>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-fork-sprint-goal="">
      {projectId === null || plan === null ? null : (
        <SprintThreadModelRow
          environmentId={environmentId}
          projectId={projectId}
          selection={pendingModel ?? parseSprintThreadModel(plan)}
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
          disk === null ? "" : "No goal yet. For example: Redesign the composer for Flat Glass."
        }
        readOnly={disk === null}
        onChange={(event) => setDraft(nextSprintFileDraft(draft, view.value, event.target.value))}
        onKeyDown={(event) => {
          // One line in PLAN.md, so Enter saves rather than breaking it.
          if (event.key === "Enter" || ((event.metaKey || event.ctrlKey) && event.key === "s")) {
            event.preventDefault();
            void save();
          }
        }}
        data-testid="sprint-goal-editor"
      />
      <div className="flex shrink-0 items-center gap-2 border-t border-border px-3.5 py-2">
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {view.stale
            ? "The sprint changed the goal since you began. Saving replaces its change."
            : view.dirty
              ? "Unsaved changes"
              : ""}
        </p>
        {view.dirty ? (
          <Button type="button" variant="ghost" size="xs" onClick={() => setDraft(null)}>
            {view.stale ? "Reload" : "Discard"}
          </Button>
        ) : null}
        <Button
          type="button"
          size="xs"
          disabled={!view.dirty || saving}
          onClick={() => void save()}
          data-testid="sprint-goal-save"
        >
          Save
        </Button>
      </div>
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
  const settings = useEnvironmentSettings(props.environmentId);
  const providers =
    useAtomValue(serverEnvironment.providersValueAtom(props.environmentId)) ??
    EMPTY_SERVER_PROVIDERS;
  const project = useProjects().find(
    (candidate) =>
      candidate.environmentId === props.environmentId && candidate.id === props.projectId,
  );
  const instanceEntries = providerInstanceEntriesFor(providers, settings, props.projectId).map(
    (entry) => ({ ...entry, models: withoutPromptInjectedLevels(entry.models) }),
  );
  const shown =
    props.selection ??
    (project === undefined ? null : scheduledTaskDefaultModel(settings, project, instanceEntries));
  const modelOptionsByInstance = getCustomModelOptionsByInstance(
    settings,
    providers,
    shown?.instanceId,
    shown?.model,
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
