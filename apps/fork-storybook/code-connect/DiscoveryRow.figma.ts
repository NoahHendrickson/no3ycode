// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=65-24
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/discovery-list.tsx
// component=DiscoveryListRow
import figma from "figma";

import { jsxAttr } from "./shared";

const row = figma.selectedInstance;
const IMPORT = 'import { DiscoveryListRow } from "~/components/ui/discovery-list";';

export default {
  example: figma.tsx`<DiscoveryListRow
  icon={icon}
  title=${jsxAttr(row.getString("Name"))}
  description=${jsxAttr(row.getString("Detail"))}${row.getBoolean("Action") ? "\n  action={action}" : ""}
  onClick={onOpen}
/>`,
  imports: [IMPORT],
  id: "discovery-row",
  metadata: { nestable: true, props: { imports: [IMPORT] } },
};
