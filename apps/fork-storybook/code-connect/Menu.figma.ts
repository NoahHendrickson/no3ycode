// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=44-256
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/menu.tsx
// component=MenuPopup
import figma from "figma";

import { code, indent, nestedImports } from "./shared";

// The popup's rows in order; a label opens a MenuGroup that runs to the next separator.
const rows = figma.selectedInstance
  .findConnectedInstances(() => true)
  .flatMap((row) =>
    row.type === "INSTANCE" ? [{ id: row.codeConnectId(), ...row.executeTemplate() }] : [],
  );
const sections: ReturnType<typeof code>[] = [];
let grouped = false;
for (const row of rows) {
  if (grouped && (row.id === "menu-label" || row.id === "menu-separator")) {
    sections.push(code("\n  </MenuGroup>"));
    grouped = false;
  }
  if (row.id === "menu-label") {
    sections.push(code("\n  <MenuGroup>"));
    grouped = true;
  }
  const pad = grouped ? "    " : "  ";
  sections.push(code(`\n${pad}`), ...indent(row.example, pad));
}
if (grouped) sections.push(code("\n  </MenuGroup>"));
const parts = rows.some((row) => row.id === "menu-label") ? "MenuGroup, MenuPopup" : "MenuPopup";

export default {
  example: figma.tsx`<MenuPopup>${sections}
</MenuPopup>`,
  imports: nestedImports(rows, [`import { ${parts} } from "~/components/ui/menu";`]),
  id: "menu",
};
