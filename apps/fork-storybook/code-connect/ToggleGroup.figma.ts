// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=61-113
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/toggle-group.tsx
// component=ToggleGroup
import figma from "figma";

import { connected, nestedImports, stack } from "./shared";

const items = connected(figma.selectedInstance, "toggle-group-item");
const on = items
  .map((item) => (item.metadata?.props ?? {}) as { value?: string; on?: boolean })
  .filter((props) => props.on)
  .map((props) => `"${props.value}"`);

export default {
  example: figma.tsx`<ToggleGroup defaultValue={[${on.join(", ")}]}>
  ${stack(items)}
</ToggleGroup>`,
  imports: nestedImports(items, ['import { ToggleGroup } from "~/components/ui/toggle-group";']),
  id: "toggle-group",
};
