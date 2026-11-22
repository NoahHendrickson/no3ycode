// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=62-42
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/combobox.tsx
// component=ComboboxItem
import figma from "figma";

import { jsxText } from "./shared";

// Items render from the combobox's items; `item` is the collection's entry.
const row = figma.selectedInstance;
const label = jsxText(row.getString("Label"));
const IMPORT = 'import { ComboboxItem } from "~/components/ui/combobox";';

export default {
  example: row.getBoolean("Show detail")
    ? figma.tsx`<ComboboxItem value={item}>
  <span className="flex min-w-0 flex-col">
    <span className="truncate">${label}</span>
    <span className="truncate text-xs text-muted-foreground">${jsxText(row.getString("Detail"))}</span>
  </span>
</ComboboxItem>`
    : figma.tsx`<ComboboxItem value={item}>${label}</ComboboxItem>`,
  imports: [IMPORT],
  id: "combobox-item",
  metadata: { nestable: true, props: { imports: [IMPORT] } },
};
