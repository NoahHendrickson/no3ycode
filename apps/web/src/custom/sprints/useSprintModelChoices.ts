/**
 * The models a sprint can pick, for the New sprint dialog and the Goal tab's thread model — see
 * `.fork/customizations.yaml#fork-sprints`. Ultrathink's prompt-prefix levels are left out:
 * there is no prompt to carry them.
 */
import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/models";
import type { EnvironmentId, ModelSelection, ProjectId } from "@t3tools/contracts";
import type { UnifiedSettings } from "@t3tools/contracts/settings";

import { useEnvironmentSettings } from "~/hooks/useSettings";
import { getCustomModelOptionsByInstance } from "~/modelSelection";
import { type ProviderInstanceEntry, providerInstanceEntriesFor } from "~/providerInstances";
import { useProjects } from "~/state/entities";
import { EMPTY_SERVER_PROVIDERS, serverEnvironment } from "~/state/server";

import { withoutPromptInjectedLevels } from "./sprintModel";

/** The project's provider instances and their models, and the selection `choose` makes of them. */
export function useSprintModelChoices(
  environmentId: EnvironmentId,
  projectId: ProjectId,
  choose: (input: {
    readonly settings: UnifiedSettings;
    readonly project: EnvironmentProject | undefined;
    readonly instanceEntries: ReadonlyArray<ProviderInstanceEntry>;
  }) => ModelSelection | null,
) {
  const settings = useEnvironmentSettings(environmentId);
  const providers =
    useAtomValue(serverEnvironment.providersValueAtom(environmentId)) ?? EMPTY_SERVER_PROVIDERS;
  const project = useProjects().find(
    (candidate) => candidate.environmentId === environmentId && candidate.id === projectId,
  );
  const instanceEntries = providerInstanceEntriesFor(providers, settings, projectId).map(
    (entry) => ({ ...entry, models: withoutPromptInjectedLevels(entry.models) }),
  );
  const selection = choose({ settings, project, instanceEntries });
  const modelOptionsByInstance = getCustomModelOptionsByInstance(
    settings,
    providers,
    selection?.instanceId,
    selection?.model,
  );
  return { instanceEntries, selection, modelOptionsByInstance };
}
