// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=15-3966
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/button.tsx
// component=Button
import figma from "figma";

import { BUTTON_VARIANTS, glyphWithImports } from "./shared";

const button = figma.selectedInstance;
const variant = button.getEnum("Variant", BUTTON_VARIANTS);
const size =
  button.getEnum("Size", {
    "icon-xs": "icon-xs",
    "icon-sm": "icon-sm",
    "icon-sm-pill": "icon-sm-pill",
    "icon-lg": "icon-lg",
  }) ?? "icon";
const disabled = button.getEnum("State", { Disabled: true });
const icon = glyphWithImports(button, "Glyph");
const BUTTON_IMPORT = 'import { Button } from "~/components/ui/button";';

const attrs = [
  variant ? ` variant="${variant}"` : "",
  ` size="${size}"`,
  disabled ? " disabled" : "",
].join("");

export default {
  example: figma.tsx`<Button${attrs} aria-label="…">
  ${icon?.example ?? []}
</Button>`,
  imports: [BUTTON_IMPORT],
  id: "icon-button",
  metadata: { nestable: true, props: { imports: [BUTTON_IMPORT, ...(icon?.imports ?? [])] } },
};
