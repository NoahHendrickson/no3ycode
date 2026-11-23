// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=45-213
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/select.tsx
// component=SelectItem
import figma from "figma";

import { jsxText, slug } from "./shared";

const item = figma.selectedInstance;
const label = item.getString("Label");
const value = slug(label);
const IMPORT = 'import { SelectItem } from "~/components/ui/select";';

// Select.figma.ts reads the picked row's value from metadata for the root's defaultValue.
export default {
  example: figma.tsx`<SelectItem value="${value}"${item.getEnum("State", { Disabled: " disabled" }) ?? ""}>${jsxText(label)}</SelectItem>`,
  imports: [IMPORT],
  id: "select-item",
  metadata: {
    nestable: true,
    props: {
      imports: [IMPORT],
      value,
      selected: item.getEnum("State", { Selected: true }) ?? false,
    },
  },
};
