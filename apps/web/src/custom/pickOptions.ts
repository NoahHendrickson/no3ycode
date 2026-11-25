/**
 * The options a model pick restores — see `.fork/customizations.yaml#fork-model-picker`.
 * One rule for the pick (useComposerSelection) and the model menu's effort preview, so the
 * preview shows what the pick will set: the options last used with that model, else, when the
 * picked model is the thread's own, the thread's options; else none (the model's defaults).
 */
import type { ProviderOptionSelection } from "@t3tools/contracts";

export function resolvePickOptions(input: {
  remembered: ReadonlyArray<ProviderOptionSelection> | undefined;
  /** The thread's options when the picked model is the thread's model. */
  threadOptions: ReadonlyArray<ProviderOptionSelection> | undefined;
}): ReadonlyArray<ProviderOptionSelection> | undefined {
  if (input.remembered !== undefined && input.remembered.length > 0) return input.remembered;
  return input.threadOptions;
}
