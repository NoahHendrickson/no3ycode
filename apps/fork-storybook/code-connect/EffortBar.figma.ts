// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=72-1068
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/ComposerModelPicker.tsx
// component=EffortSlider
import figma from "figma";

// The model picker's effort control; its stops are the model's effort options.
export default {
  example: figma.tsx`<EffortSlider
  descriptor={effortDescriptor}
  fillStops={effortDitherStops(input.provider)}
  committedIndex={effortStopIndex(effortDescriptor, ultrathinkControlled)}
  disabled={effortLocked}
  onCommit={(optionId) => selectOption(effortDescriptor, optionId)}
/>`,
  imports: [
    'import { EffortSlider } from "~/custom/ComposerModelPicker";',
    'import { effortDitherStops } from "~/custom/EffortDither";',
  ],
  id: "effort-bar",
};
