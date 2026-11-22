// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=61-25
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/separator.tsx
// component=Separator
import figma from "figma";

const vertical = figma.selectedInstance.getEnum("Orientation", { Vertical: true });
const IMPORT = 'import { Separator } from "~/components/ui/separator";';

export default {
  example: vertical ? figma.tsx`<Separator orientation="vertical" />` : figma.tsx`<Separator />`,
  imports: [IMPORT],
  id: "separator",
  metadata: { nestable: true, props: { imports: [IMPORT] } },
};
