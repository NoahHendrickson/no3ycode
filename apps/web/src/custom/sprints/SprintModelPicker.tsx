/**
 * The New sprint dialog's model and effort menu — see `.fork/customizations.yaml#fork-sprints`.
 * The composer's combined menu, controlled like the scheduled-task editor's.
 */
import type { EnvironmentId, ModelSelection } from "@t3tools/contracts";

import { ProviderModelPicker } from "~/components/chat/ProviderModelPicker";
import { SETTINGS_PICKER_TRIGGER_CLASSNAME } from "~/components/settings/settingsLayout";
import type { ProviderInstanceEntry } from "~/providerInstances";
import type { ModelEsque } from "~/components/chat/providerIconUtils";

import { ComposerModelPicker } from "../ComposerModelPicker";
import { scheduledTaskModelWithOptions } from "../scheduled/scheduledTaskModel.logic";

export function SprintModelPicker(props: {
  readonly environmentId: EnvironmentId;
  readonly instanceEntries: ReadonlyArray<ProviderInstanceEntry>;
  readonly modelOptionsByInstance: ReadonlyMap<
    ProviderInstanceEntry["instanceId"],
    ReadonlyArray<ModelEsque>
  >;
  readonly selection: ModelSelection;
  readonly disabled: boolean;
  readonly onChange: (selection: ModelSelection) => void;
}) {
  const { selection, onChange } = props;
  const instance = props.instanceEntries.find((entry) => entry.instanceId === selection.instanceId);
  const pickerProps = {
    environmentId: props.environmentId,
    disabled: props.disabled,
    activeInstanceId: selection.instanceId,
    model: selection.model,
    lockedProvider: null,
    instanceEntries: props.instanceEntries,
    modelOptionsByInstance: props.modelOptionsByInstance,
    isComposerOwned: false,
    triggerClassName: SETTINGS_PICKER_TRIGGER_CLASSNAME,
    onInstanceModelChange: (instanceId: ModelSelection["instanceId"], model: string) => {
      if (instanceId !== selection.instanceId || model !== selection.model)
        onChange({ instanceId, model });
    },
  };
  if (instance === undefined) return <ProviderModelPicker {...pickerProps} combined />;
  return (
    <ComposerModelPicker
      {...pickerProps}
      traitsInput={{
        provider: instance.driverKind,
        instanceId: selection.instanceId,
        models: instance.models,
        model: selection.model,
        modelOptions: selection.options,
        // A new sprint has no prompt for Ultrathink's prefix; its levels are filtered out.
        promptUltrathink: "none",
        onPromptEdit: () => {},
        onModelOptionsChange: (options) =>
          onChange(scheduledTaskModelWithOptions(selection, options)),
        triggerLabelSeparator: " ",
      }}
    />
  );
}
