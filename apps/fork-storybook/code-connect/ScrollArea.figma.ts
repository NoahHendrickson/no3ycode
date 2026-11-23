// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=63-87
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/scroll-area.tsx
// component=ScrollArea
import figma from "figma";

// The thumb belongs to ScrollArea's scrollbar; nothing renders it on its own.
export default {
  example: figma.tsx`<ScrollArea>{children}</ScrollArea>`,
  imports: ['import { ScrollArea } from "~/components/ui/scroll-area";'],
  id: "scroll-area",
};
