// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=59-93
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/alert-dialog.tsx
// component=AlertDialogPopup
import figma from "figma";

import { code, connected, jsxText, nestedImports, stack } from "./shared";

const dialog = figma.selectedInstance;
const described = dialog.getBoolean("Show description");
const buttons = connected(dialog, "button");
const sections = [
  code("<AlertDialog>\n  <AlertDialogPopup>\n    <AlertDialogHeader>"),
  code(`\n      <AlertDialogTitle>${jsxText(dialog.getString("Title"))}</AlertDialogTitle>`),
  ...(described
    ? [
        code(
          `\n      <AlertDialogDescription>${jsxText(dialog.getString("Description"))}</AlertDialogDescription>`,
        ),
      ]
    : []),
  code("\n    </AlertDialogHeader>\n    <AlertDialogFooter>\n      "),
  ...stack(buttons, "      "),
  code("\n    </AlertDialogFooter>\n  </AlertDialogPopup>\n</AlertDialog>"),
];
const parts = [
  "AlertDialog",
  "AlertDialogFooter",
  "AlertDialogHeader",
  "AlertDialogPopup",
  "AlertDialogTitle",
];
if (described) parts.push("AlertDialogDescription");

export default {
  example: figma.tsx`${sections}`,
  imports: nestedImports(buttons, [
    `import { ${parts.join(", ")} } from "~/components/ui/alert-dialog";`,
  ]),
  id: "alert-dialog",
};
