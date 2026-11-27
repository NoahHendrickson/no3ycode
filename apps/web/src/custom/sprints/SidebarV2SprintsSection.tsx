/**
 * The sidebar's Sprints section and the dialog that starts one — see
 * `.fork/customizations.yaml#fork-sprints`. The row has the Petals row's shape: a label that
 * folds the section and a plus. Its cards are ordinary thread cards, its children.
 */
import { useAtomValue } from "@effect/atom-react";
import { scopedProjectKey, scopeProjectRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/models";
import type { ModelSelection } from "@t3tools/contracts";
import { type ReactNode, useId, useRef, useState } from "react";

import { scheduledTaskDefaultModel } from "~/components/settings/scheduledTasksSettings.logic";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Menu, MenuCheckboxItem, MenuPopup, MenuTrigger } from "~/components/ui/menu";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { useEnvironmentSettings } from "~/hooks/useSettings";
import { useScratchProject } from "~/hooks/useScratchProject";
import { cn } from "~/lib/utils";
import { getCustomModelOptionsByInstance } from "~/modelSelection";
import { providerInstanceEntriesFor } from "~/providerInstances";
import { useProjects } from "~/state/entities";
import { EMPTY_SERVER_PROVIDERS, serverEnvironment } from "~/state/server";

import { ChevronDownIcon, PlusIcon, XIcon } from "../icons/lucide-hugeicons";
import { scheduledTaskDraftSelection } from "../scheduled/scheduledTaskModel.logic";
import { SIDEBAR_V2_CARD_ALIGNMENT } from "../sidebarV2CardAlignment";
import { SidebarChromeButton, SidebarChromeGroup } from "../SidebarChromeButton";
import { SidebarV2SectionLabel } from "../SidebarV2SectionLabel";
import { sprintDefaultModel, withoutPromptInjectedLevels } from "./sprintModel";
import { SprintModelPicker } from "./SprintModelPicker";
import { type NewSprint, useCreateSprint } from "./useCreateSprint";

export function SidebarV2SprintsRow(props: {
  readonly collapsed: boolean;
  readonly onToggleCollapsed: () => void;
  /** The project a new sprint starts in, when the open thread has one. */
  readonly defaultProject: { readonly environmentId: string; readonly projectId: string } | null;
  readonly children: ReactNode;
}) {
  const [creating, setCreating] = useState(false);
  return (
    <SidebarChromeGroup data-fork-sprints-row="" className="mt-6">
      <div className="flex min-h-8 items-center gap-1.5 px-3">
        <span role="heading" aria-level={2} className="min-w-0 flex-1 truncate text-left">
          <SidebarV2SectionLabel
            collapsed={props.collapsed}
            onToggle={props.onToggleCollapsed}
            testId="sidebar-v2-sprints-section-toggle"
          >
            Sprints
          </SidebarV2SectionLabel>
        </span>
        <div className="-me-3 flex shrink-0 items-center">
          <Tooltip>
            <TooltipTrigger
              render={
                <SidebarChromeButton
                  shape="icon"
                  type="button"
                  aria-label="New sprint"
                  data-testid="sidebar-v2-new-sprint"
                  onClick={() => setCreating(true)}
                />
              }
            >
              <PlusIcon className="size-4 shrink-0" />
            </TooltipTrigger>
            <TooltipPopup side="right">New sprint</TooltipPopup>
          </Tooltip>
        </div>
      </div>
      {/* The thread list's tooltip timing, so a sprint card's hover card opens like a thread's. */}
      <TooltipProvider delay={150} closeDelay={0} timeout={400}>
        <ul
          role="presentation"
          className={cn("mt-1 flex flex-col empty:mt-0", SIDEBAR_V2_CARD_ALIGNMENT.listGap)}
        >
          {props.children}
        </ul>
      </TooltipProvider>
      {creating ? (
        <NewSprintDialog defaultProject={props.defaultProject} onDone={() => setCreating(false)} />
      ) : null}
    </SidebarChromeGroup>
  );
}

/** Projects a sprint can start in: unarchived, not the No-project workspace, on a machine with
    a No-project workspace to keep the sprint's notes in. */
function useSprintProjects(): ReadonlyArray<EnvironmentProject> {
  const projects = useProjects();
  const { scratchWorkspaceRootFor } = useScratchProject();
  return projects.filter((project) => {
    const scratchRoot = scratchWorkspaceRootFor(project.environmentId);
    return (
      project.archivedAt == null && scratchRoot !== null && project.workspaceRoot !== scratchRoot
    );
  });
}

const projectKeyOf = (project: EnvironmentProject) =>
  scopedProjectKey(scopeProjectRef(project.environmentId, project.id));

function NewSprintDialog(props: {
  readonly defaultProject: { readonly environmentId: string; readonly projectId: string } | null;
  readonly onDone: () => void;
}) {
  const projects = useSprintProjects();
  const [submitting, setSubmitting] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !submitting) props.onDone();
      }}
    >
      <DialogPopup className="sm:max-w-md">
        {projects.length === 0 ? (
          <>
            <NewSprintHeader />
            <DialogPanel>
              <p className="text-sm text-muted-foreground">
                Add a project first. A sprint starts in one of your projects.
              </p>
            </DialogPanel>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={props.onDone}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        ) : (
          <NewSprintForm
            projects={projects}
            defaultProject={props.defaultProject}
            submitting={submitting}
            onSubmittingChange={setSubmitting}
            onDone={props.onDone}
          />
        )}
      </DialogPopup>
    </Dialog>
  );
}

function NewSprintHeader() {
  return (
    <DialogHeader>
      <DialogTitle>New sprint</DialogTitle>
      <DialogDescription>
        One conversation that plans the work, starts threads for it and keeps track of them. It only
        acts when you or its threads talk to it.
      </DialogDescription>
    </DialogHeader>
  );
}

function NewSprintForm(props: {
  readonly projects: ReadonlyArray<EnvironmentProject>;
  readonly defaultProject: { readonly environmentId: string; readonly projectId: string } | null;
  readonly submitting: boolean;
  readonly onSubmittingChange: (submitting: boolean) => void;
  readonly onDone: () => void;
}) {
  const { projects, submitting } = props;
  const id = useId();
  const createSprint = useCreateSprint();
  const fileInput = useRef<HTMLInputElement>(null);
  const [projectKey, setProjectKey] = useState(() => {
    const preferred = projects.find(
      (project) =>
        project.environmentId === props.defaultProject?.environmentId &&
        project.id === props.defaultProject.projectId,
    );
    return projectKeyOf(preferred ?? projects[0]!);
  });
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [pickedModel, setPickedModel] = useState<ModelSelection | null>(null);
  const [contextFiles, setContextFiles] = useState<ReadonlyArray<File>>([]);
  const [alsoKeys, setAlsoKeys] = useState<ReadonlySet<string>>(() => new Set());
  const project =
    projects.find((candidate) => projectKeyOf(candidate) === projectKey) ?? projects[0]!;
  // Its threads run on its own machine, so the others are that machine's projects.
  const alsoChoices = projects.filter(
    (candidate) => candidate.environmentId === project.environmentId && candidate.id !== project.id,
  );
  const otherProjects = alsoChoices.filter((candidate) => alsoKeys.has(projectKeyOf(candidate)));

  const settings = useEnvironmentSettings(project.environmentId);
  const providers =
    useAtomValue(serverEnvironment.providersValueAtom(project.environmentId)) ??
    EMPTY_SERVER_PROVIDERS;
  const instanceEntries = providerInstanceEntriesFor(providers, settings, project.id).map(
    (entry) => ({ ...entry, models: withoutPromptInjectedLevels(entry.models) }),
  );
  // A pick survives a change of project while its provider is on there.
  const modelSelection = scheduledTaskDraftSelection(
    pickedModel,
    instanceEntries,
    () =>
      sprintDefaultModel(instanceEntries) ??
      scheduledTaskDefaultModel(settings, project, instanceEntries),
  );
  const modelOptionsByInstance = getCustomModelOptionsByInstance(
    settings,
    providers,
    modelSelection?.instanceId,
    modelSelection?.model,
  );
  const canSubmit = !submitting && modelSelection !== null && name.trim() !== "";

  const addFiles = (files: FileList | null) => {
    if (files === null || files.length === 0) return;
    const added = Array.from(files);
    setContextFiles((current) => [
      ...current.filter((file) => !added.some((next) => next.name === file.name)),
      ...added,
    ]);
  };

  const submit = async (sprint: NewSprint) => {
    props.onSubmittingChange(true);
    const created = await createSprint(sprint);
    // A failure keeps the dialog and what was typed, so a retry is one click.
    if (created === null) props.onSubmittingChange(false);
    else props.onDone();
  };

  return (
    <form
      className="flex min-h-0 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit)
          void submit({ project, otherProjects, name, goal, modelSelection, contextFiles });
      }}
    >
      <NewSprintHeader />
      <DialogPanel>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-name`}>Name</Label>
            <Input
              id={`${id}-name`}
              autoFocus
              value={name}
              maxLength={80}
              placeholder="Composer redesign"
              onChange={(event) => setName(event.target.value)}
              data-testid="new-sprint-name"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-goal`}>Goal (optional)</Label>
            <Input
              id={`${id}-goal`}
              value={goal}
              maxLength={240}
              placeholder="Redesign the composer and new agent screen for Flat Glass"
              onChange={(event) => setGoal(event.target.value)}
              data-testid="new-sprint-goal"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-project`}>Project</Label>
            <Select
              value={projectKey}
              items={Object.fromEntries(
                projects.map((candidate) => [projectKeyOf(candidate), candidate.title]),
              )}
              onValueChange={(value) => {
                if (typeof value === "string") setProjectKey(value);
              }}
            >
              <SelectTrigger id={`${id}-project`} className="min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                {projects.map((candidate) => (
                  <SelectItem key={projectKeyOf(candidate)} value={projectKeyOf(candidate)}>
                    {candidate.title}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </div>
          {alsoChoices.length === 0 ? null : (
            <div className="flex flex-col gap-2" data-testid="new-sprint-also-touches">
              <Label htmlFor={`${id}-also`}>Also touches (optional)</Label>
              <Menu>
                <MenuTrigger
                  render={
                    <Button
                      id={`${id}-also`}
                      type="button"
                      variant="outline"
                      className="justify-between"
                      disabled={submitting}
                    />
                  }
                >
                  <span className="min-w-0 truncate">
                    {otherProjects.length === 0
                      ? "No other projects"
                      : otherProjects.map((other) => other.title).join(", ")}
                  </span>
                  <ChevronDownIcon />
                </MenuTrigger>
                <MenuPopup align="start">
                  {alsoChoices.map((candidate) => {
                    const key = projectKeyOf(candidate);
                    return (
                      <MenuCheckboxItem
                        key={key}
                        closeOnClick={false}
                        checked={alsoKeys.has(key)}
                        onCheckedChange={(checked) =>
                          setAlsoKeys((current) => {
                            const next = new Set(current);
                            if (checked) next.add(key);
                            else next.delete(key);
                            return next;
                          })
                        }
                      >
                        {candidate.title}
                      </MenuCheckboxItem>
                    );
                  })}
                </MenuPopup>
              </Menu>
              <p className="text-xs text-muted-foreground">
                Other projects the work spans. The sprint plans across them from its first turn.
              </p>
            </div>
          )}
          <div className="flex flex-col gap-2" data-testid="new-sprint-model">
            <Label>Model</Label>
            {modelSelection === null ? (
              <p className="text-sm text-muted-foreground">
                Sign in to a provider in Settings first.
              </p>
            ) : (
              <div className="flex">
                <SprintModelPicker
                  environmentId={project.environmentId}
                  instanceEntries={instanceEntries}
                  modelOptionsByInstance={modelOptionsByInstance}
                  selection={modelSelection}
                  disabled={submitting}
                  onChange={setPickedModel}
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              For this conversation, which plans and routes. Its threads run on the project's
              default model.
            </p>
          </div>
          <div
            className="flex flex-col gap-2"
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes("Files")) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              addFiles(event.dataTransfer.files);
            }}
          >
            <Label htmlFor={`${id}-context`}>Library files (optional)</Label>
            {contextFiles.length > 0 ? (
              <ul className="flex flex-col gap-1" data-testid="new-sprint-context-files">
                {contextFiles.map((file) => (
                  <li key={file.name} className="flex min-w-0 items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Remove ${file.name}`}
                      disabled={submitting}
                      onClick={() =>
                        setContextFiles((current) => current.filter((other) => other !== file))
                      }
                    >
                      <XIcon />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={submitting}
                onClick={() => fileInput.current?.click()}
              >
                Add files
              </Button>
              <p className="min-w-0 text-xs text-muted-foreground">
                Specs, notes, code, images or PDFs. Drop them here.
              </p>
            </div>
            <input
              ref={fileInput}
              id={`${id}-context`}
              type="file"
              multiple
              hidden
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
              data-testid="new-sprint-context-input"
            />
          </div>
        </div>
      </DialogPanel>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={props.onDone} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit} data-testid="new-sprint-create">
          Start sprint
        </Button>
      </DialogFooter>
    </form>
  );
}
