/**
 * Creating a bot — see `.fork/customizations.yaml#fork-bots`. Existing commands only.
 * The folder is seeded before the thread exists, so the bot's first session loads its instructions.
 */
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
import {
  applyProviderInstanceSettings,
  deriveProviderInstanceEntries,
  isProviderInstancePickerReady,
  sortProviderInstanceEntries,
} from "~/providerInstances";
import { EMPTY_SERVER_PROVIDERS, serverEnvironment } from "~/state/server";
import { buildThreadRouteParams } from "~/threadRoutes";

import type { BotMascotShape } from "./botMascotArt";
import { botMascotTag } from "./botMascotTags";
import { botSeedFiles } from "./botSeedFiles";
import { BOT_FOLDERS_DIRECTORY, botFolderName, botFolderPath } from "./botThreads";
import { useBotThreadCreation } from "./useBotThreadCreation";

const FAILURE_TITLE = "Could not create the petal";

/** Claude only: a bot's memory rides on Claude Code reloading CLAUDE.md and JOB.md and running
    the folder's hooks, which no other provider does. Every wake, even a quiet one, is a full
    turn, so a bot starts on the newest Sonnet without options. */
function botModelSelection(
  ...[settings, project, entries]: Parameters<typeof scheduledTaskDefaultModel>
): ModelSelection | null {
  const fallback = scheduledTaskDefaultModel(settings, project, entries);
  const ready = entries.filter(
    (entry) => entry.driverKind === "claudeAgent" && isProviderInstancePickerReady(entry),
  );
  const claude = ready.find((entry) => entry.instanceId === fallback?.instanceId) ?? ready[0];
  const models = claude?.models.filter((model) => !model.isLegacy) ?? [];
  const model =
    models.find((candidate) => candidate.slug.includes("sonnet")) ??
    models.find((candidate) => candidate.isDefault) ??
    models[0];
  return claude && model ? { instanceId: claude.instanceId, model: model.slug } : null;
}

/** Creates a bot and opens its conversation. Resolves to the bot's thread, or null when it failed. */
export function useCreateBot(): (
  name: string,
  mascot: BotMascotShape,
) => Promise<ScopedThreadRef | null> {
  const router = useRouter();
  const { scratchEnvironmentId, scratchWorkspaceRootFor, openScratchProject } = useScratchProject();
  const { registry, reportFailure, seed, createTagged, setTag } =
    useBotThreadCreation(FAILURE_TITLE);

  return async (rawName, mascot) => {
    const name = rawName.trim();
    if (name === "") return null;
    const environmentId = scratchEnvironmentId(null);
    const scratchRoot = scratchWorkspaceRootFor(environmentId);
    if (environmentId === null || scratchRoot === null) {
      reportFailure(
        "Petals run in the No-project workspace, on the primary machine or the only connected machine that has one. It is off while T3 Code's data folder is inside a git repository.",
      );
      return null;
    }
    const project = await openScratchProject(environmentId, FAILURE_TITLE);
    if (project === null) return null;

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
      reportFailure("Petals run on Claude. Sign in to Claude in Settings first.");
      return null;
    }

    const threadId = newThreadId();
    const folderName = botFolderName(name, threadId);
    const seeded = await seed(
      environmentId,
      scratchRoot,
      `${BOT_FOLDERS_DIRECTORY}/${folderName}`,
      botSeedFiles({ name, today: new Date().toISOString().slice(0, 10), threadId }),
    );
    if (!seeded) return null;

    // `bot` first: a failed mascot write leaves a bot with a face from its id. A failed `bot`
    // write would leave a stray No-project thread, so that thread goes again.
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
        worktreePath: botFolderPath(scratchRoot, folderName),
      },
      [FORK_BOT_THREAD_TAG],
    );
    if (!created) return null;
    // Reported, but the bot stands: it wears a face from its id until the mascot is changed.
    await setTag(environmentId, threadId, botMascotTag(mascot));

    const ref = { environmentId, threadId };
    void router.navigate({ to: "/$environmentId/$threadId", params: buildThreadRouteParams(ref) });
    return ref;
  };
}
