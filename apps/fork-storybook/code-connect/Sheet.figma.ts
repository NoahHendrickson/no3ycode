// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=49-79
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/sheet.tsx
// component=SheetPopup
import figma from "figma";

const side = figma.selectedInstance.getEnum("Side", { Left: "left", Bottom: "bottom" });

export default {
  example: figma.tsx`<Sheet>
  <SheetPopup${side ? ` side="${side}"` : ""}>
    <SheetHeader>
      <SheetTitle>{title}</SheetTitle>
    </SheetHeader>
    {children}
  </SheetPopup>
</Sheet>`,
  imports: ['import { Sheet, SheetHeader, SheetPopup, SheetTitle } from "~/components/ui/sheet";'],
  id: "sheet",
};
