// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=61-112
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/toggle-group.tsx
// component=Toggle
import figma from "figma";

import { jsxText, slug } from "./shared";

// ToggleGroup.figma.ts reads the pressed items' values for the group's defaultValue.
const item = figma.selectedInstance;
const label = item.getString("Label");
const value = slug(label);

export default {
  example: figma.tsx`<Toggle value="${value}">${jsxText(label)}</Toggle>`,
  imports: ['import { Toggle } from "~/components/ui/toggle-group";'],
  id: "toggle-group-item",
  metadata: {
    nestable: true,
    props: {
      imports: ['import { Toggle } from "~/components/ui/toggle-group";'],
      value,
      on: item.getEnum("State", { On: true }) ?? false,
    },
  },
};
