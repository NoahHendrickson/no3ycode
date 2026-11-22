// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=46-3
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/dialog.tsx
// component=DialogPopup
import figma from "figma";

import { code, connected, jsxText, nestedImports, stack } from "./shared";

const dialog = figma.selectedInstance;
const fields = connected(dialog, "input");
const buttons = dialog.getBoolean("Footer") ? connected(dialog, "button") : [];
const sections = [
  code(
    `<Dialog>\n  <DialogPopup${dialog.getBoolean("Close button") ? "" : " showCloseButton={false}"}>`,
  ),
  code(
    `\n    <DialogHeader>\n      <DialogTitle>${jsxText(dialog.getString("Title"))}</DialogTitle>`,
  ),
  ...(dialog.getBoolean("Show description")
    ? [
        code(
          `\n      <DialogDescription>${jsxText(dialog.getString("Description"))}</DialogDescription>`,
        ),
      ]
    : []),
  code("\n    </DialogHeader>"),
  ...(fields.length
    ? [
        code("\n    <DialogPanel>\n      "),
        ...stack(fields, "      "),
        code("\n    </DialogPanel>"),
      ]
    : []),
  ...(buttons.length
    ? [
        code("\n    <DialogFooter>\n      "),
        ...stack(buttons, "      "),
        code("\n    </DialogFooter>"),
      ]
    : []),
  code("\n  </DialogPopup>\n</Dialog>"),
];
const parts = ["Dialog", "DialogPopup", "DialogHeader", "DialogTitle"];
if (dialog.getBoolean("Show description")) parts.push("DialogDescription");
if (fields.length) parts.push("DialogPanel");
if (buttons.length) parts.push("DialogFooter");

export default {
  example: figma.tsx`${sections}`,
  imports: nestedImports(
    [...fields, ...buttons],
    [`import { ${parts.join(", ")} } from "~/components/ui/dialog";`],
  ),
  id: "dialog",
};
