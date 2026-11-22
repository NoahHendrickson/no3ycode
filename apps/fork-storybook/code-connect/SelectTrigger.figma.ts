// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=45-171
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/select.tsx
// component=SelectTrigger
import figma from "figma";

import { attrs, jsxAttr } from "./shared";

// The shown value comes from the Select's value; only the placeholder is the trigger's own.
const trigger = figma.selectedInstance;
const state = trigger.getEnum("State", {
  Placeholder: "placeholder",
  Disabled: "disabled",
  Invalid: "invalid",
});
const IMPORT = 'import { SelectTrigger, SelectValue } from "~/components/ui/select";';

export default {
  example: figma.tsx`<SelectTrigger${attrs(
    trigger.getEnum("Variant", { ghost: ' variant="ghost"' }),
    trigger.getEnum("Size", { xs: ' size="xs"', sm: ' size="sm"' }),
    state === "disabled" && " disabled",
    state === "invalid" && " aria-invalid",
  )}>
  <SelectValue${state === "placeholder" ? ` placeholder=${jsxAttr(trigger.getString("Placeholder"))}` : ""} />
</SelectTrigger>`,
  imports: [IMPORT],
  id: "select-trigger",
  metadata: { nestable: true, props: { imports: [IMPORT] } },
};
