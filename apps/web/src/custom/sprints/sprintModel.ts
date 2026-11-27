/**
 * The model a sprint's own conversation runs on — see `.fork/customizations.yaml#fork-sprints`.
 */
import type { ModelSelection, ServerProviderModel } from "@t3tools/contracts";

import { isProviderInstancePickerReady, type ProviderInstanceEntry } from "~/providerInstances";

/** Its turns only route work, so it starts on the newest Claude Sonnet at low effort, where one
    is ready; the owner can pick any model in the New sprint dialog or later in its composer. */
export function sprintDefaultModel(
  entries: ReadonlyArray<ProviderInstanceEntry>,
): ModelSelection | null {
  const claude = entries.find(
    (entry) => entry.driverKind === "claudeAgent" && isProviderInstancePickerReady(entry),
  );
  const models = claude?.models.filter((model) => !model.isLegacy) ?? [];
  const model =
    models.find((candidate) => candidate.slug.includes("sonnet")) ??
    models.find((candidate) => candidate.isDefault) ??
    models[0];
  if (claude === undefined || model === undefined) return null;
  const effort = model.capabilities?.optionDescriptors?.find(
    (descriptor) => descriptor.id === "effort",
  );
  const low =
    effort?.type === "select" && effort.options.some((option) => option.id === "low")
      ? [{ id: "effort", value: "low" }]
      : null;
  return {
    instanceId: claude.instanceId,
    model: model.slug,
    ...(low === null ? {} : { options: low }),
  };
}

/** Levels a prompt prefix turns on (Claude's Ultrathink) need a prompt, and a new sprint has none
    to carry them, so the dialog's effort menu leaves them out. */
export function withoutPromptInjectedLevels(
  models: ReadonlyArray<ServerProviderModel>,
): ReadonlyArray<ServerProviderModel> {
  return models.map((model) => {
    const descriptors = model.capabilities?.optionDescriptors;
    if (
      model.capabilities == null ||
      descriptors === undefined ||
      !descriptors.some(
        (descriptor) => descriptor.type === "select" && descriptor.promptInjectedValues,
      )
    )
      return model;
    return {
      ...model,
      capabilities: {
        ...model.capabilities,
        optionDescriptors: descriptors.map((descriptor) => {
          if (descriptor.type !== "select" || descriptor.promptInjectedValues === undefined)
            return descriptor;
          const { promptInjectedValues, ...rest } = descriptor;
          const injected = new Set(promptInjectedValues);
          return { ...rest, options: rest.options.filter((option) => !injected.has(option.id)) };
        }),
      },
    };
  });
}
