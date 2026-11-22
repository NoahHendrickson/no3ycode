// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=245-510
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/bots/PetalLayoutPicker.tsx
// component=PetalLayoutPicker
import figma from "figma";

// One of the picker's two rows; the picker draws both and marks the Petals section's layout.
export default {
  example: figma.tsx`<PetalLayoutPicker layout={props.layout} onLayoutChange={props.onLayoutChange} />`,
  imports: ['import { PetalLayoutPicker } from "~/custom/bots/PetalLayoutPicker";'],
  id: "petal-layout-option",
};
