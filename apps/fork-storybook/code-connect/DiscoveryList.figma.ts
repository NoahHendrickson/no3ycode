// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=65-51
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/discovery-list.tsx
// component=DiscoveryList
import figma from "figma";

import { connected, nestedImports, stack } from "./shared";

const rows = connected(figma.selectedInstance, "discovery-row");

export default {
  example: figma.tsx`<DiscoveryList>
  ${stack(rows)}
</DiscoveryList>`,
  imports: nestedImports(rows, ['import { DiscoveryList } from "~/components/ui/discovery-list";']),
  id: "discovery-list",
};
