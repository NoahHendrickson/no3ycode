// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=72-1081
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/overrides/components/chat/ModelPickerContent.tsx
// component=ModelPickerContent
import figma from "figma";

// The model picker's popup body (ProviderModelPicker.tsx): providers, models and traits all come
// from the environment's provider instances.
export default {
  example: figma.tsx`<ModelPickerContent
  searchInputRef={searchInputRef}
  environmentId={props.environmentId}
  activeInstanceId={activeInstanceId}
  model={props.model}
  instanceEntries={props.instanceEntries}
  modelOptionsByInstance={props.modelOptionsByInstance}
  onInstanceModelChange={handleInstanceModelChange}
  onRequestClose={() => setIsMenuOpen(false)}
  /* …and the picker's lock, keybinding and disabled-reason props */
/>`,
  imports: ['import { ModelPickerContent } from "~/components/chat/ModelPickerContent";'],
  id: "model-picker",
};
