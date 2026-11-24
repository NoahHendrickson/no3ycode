// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=61-15
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/label.tsx
// component=Label
import figma from "figma";

import { jsxText } from "./shared";

const IMPORT = 'import { Label } from "~/components/ui/label";';

// The disabled look comes from the control the label names, not from a Label prop.
export default {
  example: figma.tsx`<Label>${jsxText(figma.selectedInstance.getString("Text"))}</Label>`,
  imports: [IMPORT],
  id: "label",
  metadata: { nestable: true, props: { imports: [IMPORT] } },
};
