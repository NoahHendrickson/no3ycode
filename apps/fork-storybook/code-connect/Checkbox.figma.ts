// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=27-2078
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/checkbox.tsx
// component=Checkbox
import figma from "figma";

import { attrs } from "./shared";

const box = figma.selectedInstance;
const value = box.getEnum("Value", {
  Checked: " defaultChecked",
  Indeterminate: " indeterminate",
  Invalid: " aria-invalid",
});
const IMPORT = 'import { Checkbox } from "~/components/ui/checkbox";';

export default {
  example: figma.tsx`<Checkbox${attrs(
    box.getEnum("Variant", { contrast: ' variant="contrast"' }),
    value,
    box.getEnum("State", { Disabled: " disabled" }),
  )} aria-label="…" />`,
  imports: [IMPORT],
  id: "checkbox",
  metadata: { nestable: true, props: { imports: [IMPORT] } },
};
