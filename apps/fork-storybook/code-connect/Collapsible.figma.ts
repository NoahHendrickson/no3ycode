// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=62-88
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/collapsible.tsx
// component=Collapsible
import figma from "figma";

import { jsxText } from "./shared";

const section = figma.selectedInstance;
const open = section.getEnum("Open", { Yes: " defaultOpen" }) ?? "";

export default {
  example: figma.tsx`<Collapsible${open}>
  <CollapsibleTrigger>${jsxText(section.getString("Title"))}</CollapsibleTrigger>
  <CollapsiblePanel>{children}</CollapsiblePanel>
</Collapsible>`,
  imports: [
    'import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "~/components/ui/collapsible";',
  ],
  id: "collapsible",
};
