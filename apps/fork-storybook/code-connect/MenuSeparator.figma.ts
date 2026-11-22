// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=44-191
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/menu.tsx
// component=MenuSeparator
import figma from "figma";

// Dividers run edge to edge (.fork/AGENTS.md): -mx-1 cancels the popup's 4px scroll padding.
const IMPORT = 'import { MenuSeparator } from "~/components/ui/menu";';

export default {
  example: figma.tsx`<MenuSeparator className="-mx-1" />`,
  imports: [IMPORT],
  id: "menu-separator",
  metadata: { nestable: true, props: { imports: [IMPORT] } },
};
