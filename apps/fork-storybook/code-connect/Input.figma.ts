// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=21-80
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/input.tsx
// component=Input
import figma from "figma";

import { attrs, jsxAttr } from "./shared";

const field = figma.selectedInstance;
const size = field.getEnum("Size", { sm: "sm", lg: "lg" });
const content = field.getEnum("Content", {
  Placeholder: "placeholder",
  Filled: "filled",
  Invalid: "invalid",
});
const IMPORT = 'import { Input } from "~/components/ui/input";';

export default {
  example: figma.tsx`<Input${attrs(
    size && ` size="${size}"`,
    content === "placeholder"
      ? ` placeholder=${jsxAttr(field.getString("Placeholder"))}`
      : ` defaultValue=${jsxAttr(field.getString("Value"))}`,
    content === "invalid" && " aria-invalid",
    field.getEnum("State", { Disabled: true }) && " disabled",
  )} />`,
  imports: [IMPORT],
  id: "input",
  metadata: { nestable: true, props: { imports: [IMPORT] } },
};
