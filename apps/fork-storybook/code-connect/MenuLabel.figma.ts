// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=44-188
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/menu.tsx
// component=MenuGroupLabel
import figma from "figma";

import { jsxText } from "./shared";

// Base UI needs a group label inside a MenuGroup; Menu.figma.ts wraps it with the rows it heads.
const IMPORT = 'import { MenuGroupLabel } from "~/components/ui/menu";';

export default {
  example: figma.tsx`<MenuGroupLabel>${jsxText(figma.selectedInstance.getString("Label"))}</MenuGroupLabel>`,
  imports: [IMPORT],
  id: "menu-label",
  metadata: { nestable: true, props: { imports: [IMPORT] } },
};
