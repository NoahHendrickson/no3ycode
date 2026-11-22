// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=45-227
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/select.tsx
// component=Select
import figma from "figma";

import { connected, nestedImports, stack } from "./shared";

const select = figma.selectedInstance;
const triggers = connected(select, "select-trigger");
const items = connected(select, "select-item");
const props = (item: (typeof items)[number]) =>
  (item.metadata?.props ?? {}) as { value?: string; selected?: boolean };
const picked = items.find((item) => props(item).selected);

export default {
  example: figma.tsx`<Select${picked ? ` defaultValue="${props(picked).value}"` : ""}>
  ${stack(triggers)}
  <SelectPopup>
    ${stack(items, "    ")}
  </SelectPopup>
</Select>`,
  imports: nestedImports(
    [...triggers, ...items],
    ['import { Select, SelectPopup } from "~/components/ui/select";'],
  ),
  id: "select",
};
