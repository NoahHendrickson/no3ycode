// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=37-27
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/kbd.tsx
// component=Kbd
import figma from "figma";

import { glyphWithImports, jsxText } from "./shared";

const kbd = figma.selectedInstance;
const tag = kbd.getEnum("Variant", { outline: '<Kbd variant="outline">' }) ?? "<Kbd>";
const icon = kbd.getEnum("Content", { Icon: true }) ? glyphWithImports(kbd, "Glyph") : null;
const IMPORT = 'import { Kbd } from "~/components/ui/kbd";';

export default {
  example: icon
    ? figma.tsx`${tag}${icon.example}</Kbd>`
    : figma.tsx`${tag}${jsxText(kbd.getString("Keys"))}</Kbd>`,
  imports: [IMPORT],
  id: "kbd",
  metadata: { nestable: true, props: { imports: [IMPORT, ...(icon?.imports ?? [])] } },
};
