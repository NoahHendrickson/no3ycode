// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=51-92
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/command.tsx
// component=CommandFooter
import figma from "figma";

// The footer's key hints are KbdGroups the caller passes in.
const IMPORT = 'import { CommandFooter } from "~/components/ui/command";';

export default {
  example: figma.tsx`<CommandFooter>{hints}</CommandFooter>`,
  imports: [IMPORT],
  id: "command-footer",
  metadata: { nestable: true, props: { imports: [IMPORT] } },
};
