/**
 * Creating a sprint — see `.fork/customizations.yaml#fork-sprints`: a Petal's steps, in the chosen
 * project, its folder under the No-project workspace. Seeded once the thread stands, so a failed
 * creation leaves no folder; nothing runs there before the owner's first message.
 */
import type { EnvironmentProject } from "@t3tools/client-runtime/state/models";
import {
  DEFAULT_SERVER_SETTINGS,
  type ModelSelection,
  type ScopedThreadRef,
} from "@t3tools/contracts";
import { FORK_BOT_THREAD_TAG } from "@t3tools/shared/forkBotTags";
import { resolveProjectSettings } from "@t3tools/shared/projectSettings";
import { useRouter } from "@tanstack/react-router";

import { scheduledTaskDefaultModel } from "~/components/settings/scheduledTasksSettings.logic";
import { useScratchProject } from "~/hooks/useScratchProject";
import { newThreadId } from "~/lib/utils";
import { providerInstanceEntriesFor } from "~/providerInstances";
import { EMPTY_SERVER_PROVIDERS, serverEnvironment } from "~/state/server";
import { buildThreadRouteParams } from "~/threadRoutes";

import { botFolderName } from "../bots/botThreads";
import { useBotThreadCreation } from "../bots/useBotThreadCreation";
import { sprintSeedFiles } from "./sprintSeedFiles";
import { useAddSprintContext } from "./useAddSprintContext";
import { FORK_SPRINT_TAG, SPRINT_FOLDERS_DIRECTORY, sprintFolderPath } from "./sprintThreads";

const FAILURE_TITLE = "Could not create the sprint";

export interface NewSprint {
  readonly project: EnvironmentProject;
  /** Other projects on the same machine it plans across, named in its CLAUDE.md. */
  readonly otherProjects: ReadonlyArray<EnvironmentProject>;
  readonly name: string;
  readonly goal: string;
  /** The sprint's own conversation's model, picked in the dialog. */
  readonly modelSelection: ModelSelection;
  /** Copied into its `context/` folder. */
  readonly contextFiles: ReadonlyArray<File>;
}

/** Creates a sprint and opens its conversation. Resolves to its thread, or null when it failed. */
export function useCreateSprint(): (sprint: NewSprint) => Promise<ScopedThreadRef | null> {
  const router = useRouter();
  const { scratchWorkspaceRootFor, openScratchProject } = useScratchProject();
  const addContext = useAddSprintContext();
  const { registry, reportFailure, seed, createTagged, remove } =
    useBotThreadCreation(FAILURE_TITLE);

  return async ({ project, otherProjects, name: rawName, goal, modelSelection, contextFiles }) => {
    const name = rawName.trim();
    if (name === "") return null;
    const { environmentId } = project;
    const scratchRoot = scratchWorkspaceRootFor(environmentId);
    if (scratchRoot === null) {
      reportFailure(
        "A sprint keeps its notes in the No-project workspace of its project's machine, and that machine has none. It is off while T3 Code's data folder is inside a git repository.",
      );
      return null;
    }

    // Opening it creates the folder the sprint's notes go in, on a machine that never used it.
    if ((await openScratchProject(environmentId, FAILURE_TITLE)) === null) return null;

    const settings =
      registry.get(serverEnvironment.settingsValueAtom(environmentId)) ?? DEFAULT_SERVER_SETTINGS;
    const providers =
      registry.get(serverEnvironment.providersValueAtom(environmentId)) ?? EMPTY_SERVER_PROVIDERS;
    const entries = providerInstanceEntriesFor(providers, settings, project.id);
    // The owner's default for the project, so the work runs where they would start it themselves.
    const threadModel = scheduledTaskDefaultModel(settings, project, entries);

    const threadId = newThreadId();
    const folderName = botFolderName(name, threadId);
    const folderPath = sprintFolderPath(scratchRoot, folderName);
    const folder = `${SPRINT_FOLDERS_DIRECTORY}/${folderName}`;
    // `sprint` first: a thread tagged `bot` alone reads as a Petal, whose rules refresh would
    // overwrite the sprint's CLAUDE.md.
    const created = await createTagged(
      environmentId,
      {
        threadId,
        projectId: project.id,
        title: name,
        modelSelection,
        runtimeMode: resolveProjectSettings(settings, project.id, project).settings
          .defaultRuntimeMode,
        interactionMode: "default",
        branch: null,
        worktreePath: folderPath,
      },
      [FORK_SPRINT_TAG, FORK_BOT_THREAD_TAG],
    );
    if (!created) return null;
    const seeded = await seed(
      environmentId,
      scratchRoot,
      folder,
      sprintSeedFiles({
        name,
        goal,
        threadId,
        projectId: project.id,
        projectTitle: project.title,
        projectRoot: project.workspaceRoot,
        folderPath,
        otherProjects: otherProjects
          .filter((other) => other.environmentId === environmentId && other.id !== project.id)
          .map((other) => ({ id: other.id, title: other.title, root: other.workspaceRoot })),
        threadModel,
        today: new Date().toISOString().slice(0, 10),
      }),
    );
    // A sprint without its rules is no sprint, so the thread goes again.
    if (!seeded) {
      await remove(environmentId, threadId);
      return null;
    }
    // Not fatal: the toast names what was left out, and files can be added again later.
    if (contextFiles.length > 0) {
      await addContext({ environmentId, cwd: scratchRoot, folder }, contextFiles);
    }

    const ref = { environmentId, threadId };
    void router.navigate({ to: "/$environmentId/$threadId", params: buildThreadRouteParams(ref) });
    return ref;
  };
}
