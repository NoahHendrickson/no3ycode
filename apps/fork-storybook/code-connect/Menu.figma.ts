// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=44-256
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/menu.tsx
// component=MenuPopup
import figma from "figma";

import { code, indent, nestedImports } from "./shared";

// The popup's rows in order; a label opens a MenuGroup that runs to the next separator, and a
// run of radio rows sits in one MenuRadioGroup that starts on the selected row.
const rows = figma.selectedInstance
  .findConnectedInstances(() => true)
  .flatMap((row) =>
    row.type === "INSTANCE" ? [{ id: row.codeConnectId(), ...row.executeTemplate() }] : [],
  );
type Row = (typeof rows)[number];
const props = (row: Row | undefined) =>
  (row?.metadata?.props ?? {}) as { kind?: string; value?: string; selected?: boolean };
const isRadio = (row: Row | undefined) => props(row).kind === "radio";
const sections: ReturnType<typeof code>[] = [];
let grouped = false;
let radio = false;
const pad = () => `  ${grouped ? "  " : ""}${radio ? "  " : ""}`;
rows.forEach((row, index) => {
  if (radio && !isRadio(row)) {
    radio = false;
    sections.push(code(`\n${pad()}</MenuRadioGroup>`));
  }
  if (grouped && (row.id === "menu-label" || row.id === "menu-separator")) {
    grouped = false;
    sections.push(code(`\n${pad()}</MenuGroup>`));
  }
  if (row.id === "menu-label") {
    sections.push(code(`\n${pad()}<MenuGroup>`));
    grouped = true;
  }
  if (!radio && isRadio(row)) {
    let end = index;
    while (isRadio(rows[end])) end += 1;
    const picked = rows.slice(index, end).find((run) => props(run).selected);
    sections.push(
      code(`\n${pad()}<MenuRadioGroup${picked ? ` defaultValue="${props(picked).value}"` : ""}>`),
    );
    radio = true;
  }
  sections.push(code(`\n${pad()}`), ...indent(row.example, pad()));
});
if (radio) sections.push(code(`\n${grouped ? "    " : "  "}</MenuRadioGroup>`));
if (grouped) sections.push(code("\n  </MenuGroup>"));
const parts = ["MenuPopup"];
if (rows.some((row) => row.id === "menu-label")) parts.push("MenuGroup");
if (rows.some(isRadio)) parts.push("MenuRadioGroup");

export default {
  example: figma.tsx`<MenuPopup>${sections}
</MenuPopup>`,
  imports: nestedImports(rows, [`import { ${parts.join(", ")} } from "~/components/ui/menu";`]),
  id: "menu",
};
