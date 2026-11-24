/**
 * Resolves the composer's model traits for the fork's combined model menu —
 * see `.fork/customizations.yaml#fork-model-picker`.
 *
 * Mirrors upstream's TraitsMenuContent selection (same capabilities, same
 * implicit fast-mode default, same Ultrathink detection) so the menu's
 * reasoning half reads and writes exactly what the traits picker did.
 */
import { isReasoningSelect } from "@t3tools/client-runtime/model-traits";
import type {
  ModelSelection,
  ProviderDriverKind,
  ProviderInstanceId,
  ProviderOptionDescriptor,
  ProviderOptionSelection,
  ProviderOptionSelections,
  ScopedThreadRef,
  ServerProviderModel,
} from "@t3tools/contracts";
import {
  getProviderOptionCurrentValue,
  getProviderOptionDescriptors,
  normalizeModelSlug,
  withImplicitFastModeDefault,
} from "@t3tools/shared/model";

import {
  buildTraitsTriggerDisplay,
  buildUnavailableModelOptionDescriptors,
  type PromptUltrathink,
} from "../components/chat/TraitsPicker";
import type { DraftId } from "../composerDraftStore";
import { m } from "../i18n/messages";
import { getProviderModelCapabilities, keepsUnavailableModelOptions } from "../providerModels";

/** The composer's traits input: the model, its options and where a pick persists. */
export type ComposerModelTraitsInput = {
  provider: ProviderDriverKind;
  instanceId?: ProviderInstanceId;
  threadRef?: ScopedThreadRef;
  draftId?: DraftId;
  model: string;
  models: ReadonlyArray<ServerProviderModel>;
  modelOptions: ReadonlyArray<ProviderOptionSelection> | undefined;
  reportedModelSelection?: ModelSelection | null | undefined;
  promptUltrathink: PromptUltrathink;
  onPromptEdit: (edit: (prompt: string) => string) => void;
  triggerLabelSeparator?: string;
  includePlanAgent?: boolean | undefined;
  /** Controlled editors persist options on their own draft rather than a conversation. */
  onModelOptionsChange?: (options: ProviderOptionSelections | undefined) => void;
};

export type SelectDescriptor = Extract<ProviderOptionDescriptor, { type: "select" }>;

/** The option the selected row's effort menu drives: a reasoning select with at least two levels. */
export function findEffortDescriptor(
  descriptors: ReadonlyArray<ProviderOptionDescriptor>,
): SelectDescriptor | null {
  return (
    descriptors.find(
      (descriptor): descriptor is SelectDescriptor =>
        isReasoningSelect(descriptor) && descriptor.options.length > 1,
    ) ?? null
  );
}

/** A select offers a choice when it has two values, or when its one value is not yet in force,
    so picking it still changes the request (Codex's Cyber Access when its default is unknown). */
function offersChoice(descriptor: ProviderOptionDescriptor): boolean {
  return (
    descriptor.type !== "select" ||
    descriptor.options.length > 1 ||
    getProviderOptionCurrentValue(descriptor) === undefined
  );
}

/**
 * A two-value select with a standard value reads as an on/off checkbox: unchecked is the standard
 * value, checked the other (Codex's Fast service tier, its Cyber access program).
 */
export function selectToggle(descriptor: SelectDescriptor) {
  if (descriptor.options.length !== 2) return null;
  const off = descriptor.options.find((option) => STANDARD_OPTION_IDS.has(option.id));
  const on = descriptor.options.find((option) => option !== off);
  if (!off || !on) return null;
  return {
    off: off.id,
    on: on.id,
    checked: getProviderOptionCurrentValue(descriptor) === on.id,
    label: descriptor.id === "cyberAccessProgram" ? "Cyber mode" : `${on.label} mode`,
  };
}

const STANDARD_OPTION_IDS = new Set(["default", "standard"]);

/**
 * Rows under the list keep one order whatever the provider lists: the rest
 * in the provider's order, then Fast Mode, then Context Window last.
 */
const TRAIT_ROW_RANK: Readonly<Record<string, number>> = { fastMode: 1, contextWindow: 2 };

export function orderTraitRows(
  descriptors: ReadonlyArray<ProviderOptionDescriptor>,
  effortDescriptor: SelectDescriptor | null,
): ReadonlyArray<ProviderOptionDescriptor> {
  return descriptors
    .filter((descriptor) => descriptor !== effortDescriptor)
    .toSorted((a, b) => (TRAIT_ROW_RANK[a.id] ?? 0) - (TRAIT_ROW_RANK[b.id] ?? 0));
}

/** The effort level in force; a prompt-injected Ultrathink outranks the stored value. */
export function effortStopIndex(descriptor: SelectDescriptor, ultrathinkActive: boolean): number {
  const value = ultrathinkActive ? "ultrathink" : getProviderOptionCurrentValue(descriptor);
  const index = descriptor.options.findIndex((option) => option.id === value);
  if (index >= 0) return index;
  return Math.max(
    0,
    descriptor.options.findIndex((option) => option.isDefault),
  );
}

export type ComposerModelTraits = ReturnType<typeof resolveComposerModelTraits>;

/** Null when the model has nothing to configure or no destination for edited options. */
export function resolveComposerModelTraits(input: ComposerModelTraitsInput) {
  const { provider, model, models, promptUltrathink, includePlanAgent } = input;
  if (
    input.threadRef === undefined &&
    input.draftId === undefined &&
    input.onModelOptionsChange === undefined
  )
    return null;

  const caps = getProviderModelCapabilities(models, model, provider, includePlanAgent);
  const modelOptions = withImplicitFastModeDefault(caps, input.modelOptions);
  const modelIsUnavailable =
    keepsUnavailableModelOptions(provider, model) &&
    !models.some((candidate) => candidate.slug === normalizeModelSlug(model, provider));
  const descriptors = modelIsUnavailable
    ? buildUnavailableModelOptionDescriptors(
        includePlanAgent
          ? modelOptions
          : modelOptions?.filter((option) => option.id !== "agent" || option.value !== "plan"),
        m,
      )
    : getProviderOptionDescriptors({ caps, selections: modelOptions });
  if (descriptors.length === 0) return null;

  // Upstream ties Ultrathink to the first select, whatever its id.
  const primarySelect =
    descriptors.find(
      (descriptor): descriptor is SelectDescriptor => descriptor.type === "select",
    ) ?? null;
  // Upstream reads the prompt once (readPromptUltrathink) and hands the verdict in.
  const ultrathinkPromptControlled =
    (primarySelect?.promptInjectedValues?.length ?? 0) > 0 && promptUltrathink !== "none";
  const ultrathinkInBodyText = ultrathinkPromptControlled && promptUltrathink === "body";
  const effortDescriptor = modelIsUnavailable ? null : findEffortDescriptor(descriptors);
  // Saved options show read-only as they were saved. An editable option with nothing to pick gets
  // no row and stays out of the trigger; `descriptors` keeps it, so the stored value is untouched.
  const shown = modelIsUnavailable ? descriptors : descriptors.filter(offersChoice);
  const rows = orderTraitRows(shown, effortDescriptor);
  if (effortDescriptor === null && rows.length === 0) return null;

  return {
    descriptors,
    rows,
    primarySelectId: primarySelect?.id ?? null,
    effortDescriptor,
    ultrathinkPromptControlled,
    ultrathinkInBodyText,
    modelIsUnavailable,
    trigger: buildTraitsTriggerDisplay(
      {
        descriptors: shown,
        primarySelectDescriptorId: primarySelect?.id ?? null,
        ultrathinkPromptControlled,
        labelSeparator: " ",
      },
      m,
    ),
  };
}
