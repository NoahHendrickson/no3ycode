/**
 * Creating a bot — see `.fork/customizations.yaml#fork-bots`. Existing commands only.
 * The folder is seeded before the thread exists, so the bot's first session loads its instructions.
 */
import { RegistryContext } from "@effect/atom-react";
import {
  type AtomCommandResult,
  isAtomCommandInterrupted,
  runAtomCommand,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import {
  DEFAULT_SERVER_SETTINGS,
  type ModelSelection,
  type ScopedThreadRef,
} from "@t3tools/contracts";
import { resolveProjectSettings } from "@t3tools/shared/projectSettings";
import { useRouter } from "@tanstack/react-router";
import { useContext } from "react";

import { scheduledTaskDefaultModel } from "~/components/settings/scheduledTasksSettings.logic";
import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { useScratchProject } from "~/hooks/useScratchProject";
import { newThreadId } from "~/lib/utils";
import {
  applyProviderInstanceSettings,
  deriveProviderInstanceEntries,
  isProviderInstancePickerReady,
  sortProviderInstanceEntries,
} from "~/providerInstances";
import { projectEnvironment } from "~/state/projects";
import { EMPTY_SERVER_PROVIDERS, serverEnvironment } from "~/state/server";
import { threadEnvironment } from "~/state/threads";
import { buildThreadRouteParams } from "~/threadRoutes";

import { type BotMascotShape, botMascotTag } from "./botMascots";
import { botSeedFiles } from "./botSeedFiles";
import { BOT_FOLDERS_DIRECTORY, BOT_THREAD_TAG, botFolderName, botFolderPath } from "./botThreads";

const FAILURE_TITLE = "Could not create the bot";

/** Claude first: a bot's memory rides on Claude Code reloading CLAUDE.md and running the
    folder's hooks. Any other provider gets the folder's AGENTS.md pointer instead. */
function botModelSelection(
  ...[settings, project, entries]: Parameters<typeof scheduledTaskDefaultModel>
): ModelSelection | null {
  const fallback = scheduledTaskDefaultModel(settings, project, entries);
  const isClaude = (entry: (typeof entries)[number]) => entry.driverKind === "claudeAgent";
  if (entries.some((entry) => entry.instanceId === fallback?.instanceId && isClaude(entry))) {
    return fallback;
  }
  const claude = entries.find((entry) => isClaude(entry) && isProviderInstancePickerReady(entry));
  const models = claude?.models.filter((model) => !model.isLegacy) ?? [];
  const model = models.find((candidate) => candidate.isDefault) ?? models[0];
  return claude && model ? { instanceId: claude.instanceId, model: model.slug } : fallback;
}

function reportFailure(description: string) {
  toastManager.add(stackedThreadToast({ type: "error", title: FAILURE_TITLE, description }));
}

/** Creates a bot and opens its conversation. Resolves to the bot's thread, or null when it failed. */
export function useCreateBot(): (
  name: string,
  mascot: BotMascotShape,
) => Promise<ScopedThreadRef | null> {
  const registry = useContext(RegistryContext);
  const router = useRouter();
  const { scratchEnvironmentId, scratchWorkspaceRootFor, openScratchProject } = useScratchProject();

  return async (rawName, mascot) => {
    const name = rawName.trim();
    if (name === "") return null;
    const environmentId = scratchEnvironmentId(null);
    const scratchRoot = scratchWorkspaceRootFor(environmentId);
    if (environmentId === null || scratchRoot === null) {
      reportFailure(
        "Bots run in the No-project workspace, on the primary machine or the only connected machine that has one. It is off while T3 Code's data folder is inside a git repository.",
      );
      return null;
    }
    const project = await openScratchProject(environmentId, FAILURE_TITLE);
    if (project === null) return null;

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
    const modelSelection = botModelSelection(
      settings,
      project,
      sortProviderInstanceEntries(
        applyProviderInstanceSettings(
          deriveProviderInstanceEntries(providers),
          settings,
          project.id,
        ),
      ),
    );
    if (modelSelection === null) {
      reportFailure("No model is available. Sign in to a provider in Settings first.");
      return null;
    }

    const threadId = newThreadId();
    const folderName = botFolderName(name, threadId);
    for (const file of botSeedFiles({
      name,
      today: new Date().toISOString().slice(0, 10),
      threadId,
    })) {
      const written = await run(projectEnvironment.writeFile, {
        environmentId,
        input: {
          cwd: scratchRoot,
          relativePath: `${BOT_FOLDERS_DIRECTORY}/${folderName}/${file.relativePath}`,
          contents: file.contents,
        },
      });
      if (failed(written)) return null;
    }

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
        worktreePath: botFolderPath(scratchRoot, folderName),
      },
    });
    if (failed(created)) return null;
    // The mascot first, so the bot is never listed wearing another face.
    for (const tag of [botMascotTag(mascot), BOT_THREAD_TAG]) {
      const tagged = await run(threadEnvironment.setTag, {
        environmentId,
        input: { threadId, tag, tagged: true },
      });
      if (failed(tagged)) return null;
    }

    const ref = { environmentId, threadId };
    void router.navigate({ to: "/$environmentId/$threadId", params: buildThreadRouteParams(ref) });
    return ref;
  };
}
