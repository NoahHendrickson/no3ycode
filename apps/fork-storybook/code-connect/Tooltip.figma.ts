// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=58-2
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/tooltip.tsx
// component=TooltipPopup
import figma from "figma";

import { jsxText } from "./shared";

export default {
  example: figma.tsx`<Tooltip>
  <TooltipTrigger render={trigger} />
  <TooltipPopup>${jsxText(figma.selectedInstance.getString("Label"))}</TooltipPopup>
</Tooltip>`,
  imports: ['import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";'],
  id: "tooltip",
};
