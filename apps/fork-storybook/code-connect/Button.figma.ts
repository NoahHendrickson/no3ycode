// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=15-3730
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/button.tsx
// component=Button
import figma from "figma";

import { BUTTON_VARIANTS, glyph, jsxText } from "./shared";

const button = figma.selectedInstance;
const variant = button.getEnum("Variant", BUTTON_VARIANTS);
const size = button.getEnum("Size", { xs: "xs", sm: "sm", "sm-pill": "sm-pill", lg: "lg" });
const disabled = button.getEnum("State", { Disabled: true });
const slot = button.getEnum("Icon", { Left: "Leading glyph", Right: "Trailing glyph" });
const icon = slot ? glyph(button, slot)?.example : null;
const label = jsxText(button.getString("Label"));

const attrs = [
  variant ? ` variant="${variant}"` : "",
  size ? ` size="${size}"` : "",
  disabled ? " disabled" : "",
].join("");

export default {
  example: !icon
    ? figma.tsx`<Button${attrs}>${label}</Button>`
    : slot === "Leading glyph"
      ? figma.tsx`<Button${attrs}>
  ${icon}
  ${label}
</Button>`
      : figma.tsx`<Button${attrs}>
  ${label}
  ${icon}
</Button>`,
  imports: ['import { Button } from "~/components/ui/button";'],
  id: "button",
  metadata: { nestable: true },
};
