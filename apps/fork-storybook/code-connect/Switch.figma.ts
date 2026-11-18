// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=30-72
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/switch.tsx
// component=Switch
import figma from "figma";

const control = figma.selectedInstance;
const small = control.getEnum("Size", { sm: true });
const on = control.getEnum("Value", { On: true });
const disabled = control.getEnum("State", { Disabled: true });

const attrs = [
  small ? ' size="sm"' : "",
  on ? " defaultChecked" : "",
  disabled ? " disabled" : "",
].join("");

export default {
  example: figma.tsx`<Switch${attrs} aria-label="Setting" />`,
  imports: ['import { Switch } from "~/components/ui/switch";'],
  id: "switch",
  metadata: { nestable: true },
};
