// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=62-32
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/combobox.tsx
// component=ComboboxTrigger
import figma from "figma";

import { jsxText } from "./shared";

// The trigger renders as the select's button, as the font pickers draw it.
const trigger = figma.selectedInstance;
const disabled = trigger.getEnum("State", { Disabled: " disabled" }) ?? "";
const imports = [
  'import { ComboboxTrigger } from "~/components/ui/combobox";',
  'import { SelectButton } from "~/components/ui/select";',
];

export default {
  example: figma.tsx`<ComboboxTrigger render={<SelectButton />}${disabled}>${jsxText(trigger.getString("Value"))}</ComboboxTrigger>`,
  imports,
  id: "combobox-trigger",
  metadata: { nestable: true, props: { imports } },
};
