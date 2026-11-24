/**
 * The model picker's row control slot — see `.fork/customizations.yaml#fork-model-picker`.
 * A host (the composer's ComposerModelPicker) renders one control per row before its pin.
 */
import type { ProviderInstanceId } from "@t3tools/contracts";
import type { ReactNode } from "react";

export type RenderRowControl = (
  model: { instanceId: ProviderInstanceId; slug: string },
  state: { selected: boolean; pick: () => void },
) => ReactNode;

/** Calls the host's row control as a component, so `pick` travels as a handler prop. */
export function RowControlSlot(props: {
  render: RenderRowControl;
  model: { instanceId: ProviderInstanceId; slug: string };
  selected: boolean;
  onPick: () => void;
}) {
  return props.render(props.model, { selected: props.selected, pick: props.onPick });
}
