// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=61-100
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/number-field.tsx
// component=NumberField
import figma from "figma";

const field = figma.selectedInstance;
const value = Number(field.getString("Value"));
const disabled = field.getEnum("State", { Disabled: " disabled" }) ?? "";

export default {
  example: figma.tsx`<NumberField defaultValue={${Number.isFinite(value) ? String(value) : "0"}}${disabled}>
  <NumberFieldGroup>
    <NumberFieldDecrement />
    <NumberFieldInput aria-label="…" />
    <NumberFieldIncrement />
  </NumberFieldGroup>
</NumberField>`,
  imports: [
    'import { NumberField, NumberFieldDecrement, NumberFieldGroup, NumberFieldIncrement, NumberFieldInput } from "~/components/ui/number-field";',
  ],
  id: "number-field",
};
