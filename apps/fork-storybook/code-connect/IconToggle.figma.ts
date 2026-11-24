// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=39-492
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/toggle.tsx
// component=Toggle
import figma from "figma";

import { attrs, glyphWithImports } from "./shared";

const toggle = figma.selectedInstance;
const tag = `<Toggle${attrs(
  toggle.getEnum("Variant", { outline: ' variant="outline"', ghost: ' variant="ghost"' }),
  toggle.getEnum("Size", { xs: ' size="xs"', sm: ' size="sm"' }),
  toggle.getEnum("State", { On: " defaultPressed", Disabled: " disabled" }),
)}`;
const IMPORT = 'import { Toggle } from "~/components/ui/toggle";';
const icon = glyphWithImports(toggle, "Glyph");

export default {
  example: figma.tsx`${tag} aria-label="…">
  ${icon?.example ?? []}
</Toggle>`,
  imports: [IMPORT],
  id: "icon-toggle",
  metadata: { nestable: true, props: { imports: [IMPORT, ...(icon?.imports ?? [])] } },
};
