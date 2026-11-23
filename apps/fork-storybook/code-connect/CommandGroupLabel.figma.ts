// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=51-84
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/command.tsx
// component=CommandGroupLabel
import figma from "figma";

import { jsxText } from "./shared";

const IMPORT = 'import { CommandGroupLabel } from "~/components/ui/command";';

export default {
  example: figma.tsx`<CommandGroupLabel>${jsxText(figma.selectedInstance.getString("Label"))}</CommandGroupLabel>`,
  imports: [IMPORT],
  id: "command-group-label",
  metadata: { nestable: true, props: { imports: [IMPORT] } },
};
