// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=28-30
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/radio-group.tsx
// component=Radio
import figma from "figma";

import { attrs } from "./shared";

// A radio is checked through its group's value, so a checked one shows the group around it.
const radio = figma.selectedInstance;
const value = radio.getEnum("Value", { Checked: "checked", Invalid: "invalid" });
const item = `<Radio value="option"${attrs(
  value === "invalid" && " aria-invalid",
  radio.getEnum("State", { Disabled: " disabled" }),
)} />`;

export default {
  example:
    value === "checked"
      ? figma.tsx`<RadioGroup defaultValue="option">
  ${item}
</RadioGroup>`
      : figma.tsx`${item}`,
  imports: [
    value === "checked"
      ? 'import { Radio, RadioGroup } from "~/components/ui/radio-group";'
      : 'import { Radio } from "~/components/ui/radio-group";',
  ],
  id: "radio",
  metadata: { nestable: true },
};
