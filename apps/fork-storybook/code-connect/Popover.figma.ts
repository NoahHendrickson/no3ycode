// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=58-25
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/popover.tsx
// component=PopoverPopup
import figma from "figma";

import { jsxText } from "./shared";

const popover = figma.selectedInstance;
const width = popover.getEnum("Width", { sm: "sm", md: "md" });
const titled = popover.getBoolean("Show title");
const body = jsxText(popover.getString("Description"));

export default {
  example: titled
    ? figma.tsx`<Popover>
  <PopoverTrigger render={trigger} />
  <PopoverPopup${width ? ` width="${width}"` : ""}>
    <PopoverTitle>${jsxText(popover.getString("Title"))}</PopoverTitle>
    ${body}
  </PopoverPopup>
</Popover>`
    : figma.tsx`<Popover>
  <PopoverTrigger render={trigger} />
  <PopoverPopup${width ? ` width="${width}"` : ""}>${body}</PopoverPopup>
</Popover>`,
  imports: [
    titled
      ? 'import { Popover, PopoverPopup, PopoverTitle, PopoverTrigger } from "~/components/ui/popover";'
      : 'import { Popover, PopoverPopup, PopoverTrigger } from "~/components/ui/popover";',
  ],
  id: "popover",
};
