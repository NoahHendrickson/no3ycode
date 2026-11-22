// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=51-86
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/command.tsx
// component=CommandInput
import figma from "figma";

import { jsxAttr } from "./shared";

const IMPORT = 'import { CommandInput } from "~/components/ui/command";';

export default {
  example: figma.tsx`<CommandInput placeholder=${jsxAttr(figma.selectedInstance.getString("Placeholder"))} />`,
  imports: [IMPORT],
  id: "command-input",
  metadata: { nestable: true, props: { imports: [IMPORT] } },
};
