// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=61-72
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/input-group.tsx
// component=InputGroup
import figma from "figma";

import { jsxAttr, jsxText, layer, nestedImports } from "./shared";

const group = figma.selectedInstance;
const addon = group.getEnum("Addon", {
  "Icon start": "start",
  "Icon end": "end",
  "Label above": "above",
});
const value = group.findText("Value");
const placeholder = value.type === "TEXT" ? ` placeholder=${jsxAttr(value.textContent)}` : "";
const icon = layer(group, "Addon");
const glyphCode = icon?.example ?? [];
const label = group.findText("Addon label");

export default {
  example:
    addon === "above"
      ? figma.tsx`<InputGroup>
  <InputGroupAddon align="block-start">${jsxText(label.type === "TEXT" ? label.textContent : "Label")}</InputGroupAddon>
  <InputGroupInput${placeholder} />
</InputGroup>`
      : addon === "end"
        ? figma.tsx`<InputGroup>
  <InputGroupInput${placeholder} />
  <InputGroupAddon align="inline-end">${glyphCode}</InputGroupAddon>
</InputGroup>`
        : figma.tsx`<InputGroup>
  <InputGroupAddon>${glyphCode}</InputGroupAddon>
  <InputGroupInput${placeholder} />
</InputGroup>`,
  imports: nestedImports(icon && addon !== "above" ? [icon] : [], [
    'import { InputGroup, InputGroupAddon, InputGroupInput } from "~/components/ui/input-group";',
  ]),
  id: "input-group",
};
