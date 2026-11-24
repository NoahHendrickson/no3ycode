// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=51-71
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/command.tsx
// component=CommandItem
import figma from "figma";

import { jsxText } from "./shared";

// Palette rows render from the palette's items; `item` is the collection's entry.
const row = figma.selectedInstance;
const label = jsxText(row.getString("Label"));
const shortcut = row.getEnum("Type", { Shortcut: true });
const imports = [
  `import { ${shortcut ? "CommandItem, CommandShortcut" : "CommandItem"} } from "~/components/ui/command";`,
];

export default {
  example: shortcut
    ? figma.tsx`<CommandItem value={item}>
  ${label}
  <CommandShortcut>${jsxText(row.getString("Keys"))}</CommandShortcut>
</CommandItem>`
    : figma.tsx`<CommandItem value={item}>${label}</CommandItem>`,
  imports,
  id: "command-item",
  metadata: { nestable: true, props: { imports } },
};
