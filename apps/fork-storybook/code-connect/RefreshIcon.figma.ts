// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=63-77
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/refresh-icon.tsx
// component=RefreshIcon
import figma from "figma";

const size = figma.selectedInstance.getEnum("Size", {
  "12": "xs",
  "14": "sm",
  "16": "md",
  "20": "lg",
});
const IMPORT = 'import { RefreshIcon } from "~/components/ui/refresh-icon";';

export default {
  example: figma.tsx`<RefreshIcon${size ? ` size="${size}"` : ""} />`,
  imports: [IMPORT],
  id: "refresh-icon",
  metadata: { nestable: true, props: { imports: [IMPORT] } },
};
