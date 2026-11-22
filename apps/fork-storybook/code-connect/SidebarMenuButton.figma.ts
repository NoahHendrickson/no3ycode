// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=68-51
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/sidebar.tsx
// component=SidebarMenuButton
import figma from "figma";

import { glyphWithImports, jsxAttr, jsxText } from "./shared";

const button = figma.selectedInstance;
const state = button.getEnum("State", { Selected: " isActive", Disabled: " disabled" }) ?? "";
const label = button.getString("Label");
const icon = glyphWithImports(button, "Glyph");
const IMPORT = 'import { SidebarMenuButton } from "~/components/ui/sidebar";';

export default {
  example: figma.tsx`<SidebarMenuButton${state} tooltip=${jsxAttr(label)}>
  ${icon?.example ?? []}
  <span>${jsxText(label)}</span>
</SidebarMenuButton>`,
  imports: [IMPORT],
  id: "sidebar-menu-button",
  metadata: { nestable: true, props: { imports: [IMPORT, ...(icon?.imports ?? [])] } },
};
