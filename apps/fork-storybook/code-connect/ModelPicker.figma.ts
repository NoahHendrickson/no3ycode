// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=72-1081
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/ComposerModelPicker.tsx
// component=ComposerModelPicker
import figma from "figma";

// The composer's model menu: ProviderModelPicker with each row's effort and its Effort menu.
// Providers, models and traits all come from the environment's provider instances.
export default {
  example: figma.tsx`<ComposerModelPicker
  environmentId={environmentId}
  isComposerOwned
  activeInstanceId={activeInstanceId}
  model={model}
  lockedProvider={lockedProvider}
  instanceEntries={instanceEntries}
  modelOptionsByInstance={modelOptionsByInstance}
  onInstanceModelChange={handleInstanceModelChange}
  traitsInput={traitsInput}
/>`,
  imports: ['import { ComposerModelPicker } from "~/custom/ComposerModelPicker";'],
  id: "model-picker",
};
