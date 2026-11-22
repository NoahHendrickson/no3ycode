// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=63-33
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/middle-truncate.tsx
// component=MiddleTruncate
import figma from "figma";

import { jsxAttr } from "./shared";

// The kit splits the sample into head and tail; the app passes the whole string.
const text = figma.selectedInstance;
const value = `${text.getString("Head")}${text.getString("Tail")}`;
const IMPORT = 'import { MiddleTruncate } from "~/components/ui/middle-truncate";';

export default {
  example: figma.tsx`<MiddleTruncate value=${jsxAttr(value)} />`,
  imports: [IMPORT],
  id: "middle-truncate",
  metadata: { nestable: true, props: { imports: [IMPORT] } },
};
