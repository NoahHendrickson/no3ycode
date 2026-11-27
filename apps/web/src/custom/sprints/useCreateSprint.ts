/**
 * Creating a sprint — see `.fork/customizations.yaml#fork-sprints`. Existing commands only, as
 * a Petal is made (bots/useCreateBot), but the thread belongs to the chosen project while its
 * folder sits under the No-project workspace, out of the project's checkout.
 */
import { RegistryContext } from "@effect/atom-react";
import {
  type AtomCommandResult,
  isAtomCommandInterrupted,
  runAtomCommand,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/models";
import {
  DEFAULT_SERVER_SETTINGS,
  type ModelSelection,
  type ScopedThreadRef,
} from "@t3tools/contracts";
import { FORK_BOT_THREAD_TAG } from "@t3tools/shared/forkBotTags";
import { resolveProjectSettings } from "@t3tools/shared/projectSettings";
import { useRouter } from "@tanstack/react-router";
import { useContext } from "react";

import { scheduledTaskDefaultModel } from "~/components/settings/scheduledTasksSettings.logic";
import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { useScratchProject } from "~/hooks/useScratchProject";
import { newThreadId } from "~/lib/utils";
import { providerInstanceEntriesFor } from "~/providerInstances";
import { projectEnvironment } from "~/state/projects";
import { EMPTY_SERVER_PROVIDERS, serverEnvironment } from "~/state/server";
import { threadEnvironment } from "~/state/threads";
import { buildThreadRouteParams } from "~/threadRoutes";

import { botFolderName } from "../bots/botThreads";
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
  const registry = useContext(RegistryContext);
  const router = useRouter();
  const { scratchWorkspaceRootFor, openScratchProject } = useScratchProject();
  const addContext = useAddSprintContext();

  const reportFailure = (description: string) => {
    toastManager.add(stackedThreadToast({ type: "error", title: FAILURE_TITLE, description }));
  };

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

    const failed = (result: AtomCommandResult<unknown, unknown>) => {
      if (result._tag === "Success") return false;
      if (!isAtomCommandInterrupted(result)) {
        const error = squashAtomCommandFailure(result);
        reportFailure(error instanceof Error ? error.message : "An error occurred.");
      }
      return true;
    };
    const run = <W, A, E>(command: Parameters<typeof runAtomCommand<W, A, E>>[1], value: W) =>
      runAtomCommand(registry, command, value, {
        label: command.label,
        reportFailure: false,
        reportDefect: true,
      });

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
    const seeded = await Promise.all(
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
      }).map((file) =>
        run(projectEnvironment.writeFile, {
          environmentId,
          input: {
            cwd: scratchRoot,
            relativePath: `${SPRINT_FOLDERS_DIRECTORY}/${folderName}/${file.relativePath}`,
            contents: file.contents,
          },
        }),
      ),
    );
    if (seeded.some(failed)) return null;
    // Not fatal: the toast names what was left out, and files can be added again later.
    if (contextFiles.length > 0)
      await addContext(
        { environmentId, cwd: scratchRoot, folder: `${SPRINT_FOLDERS_DIRECTORY}/${folderName}` },
        contextFiles,
      );

    const created = await run(threadEnvironment.create, {
      environmentId,
      input: {
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
    });
    if (failed(created)) return null;
    // `bot` first, as a Petal: the server links its work by that tag. A failed tag would leave
    // a stray thread, so the thread goes again.
    for (const tag of [FORK_BOT_THREAD_TAG, FORK_SPRINT_TAG]) {
      const tagged = await run(threadEnvironment.setTag, {
        environmentId,
        input: { threadId, tag, tagged: true },
      });
      if (failed(tagged)) {
        await run(threadEnvironment.delete, { environmentId, input: { threadId } });
        return null;
      }
    }

    const ref = { environmentId, threadId };
    void router.navigate({ to: "/$environmentId/$threadId", params: buildThreadRouteParams(ref) });
    return ref;
  };
}
