// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=51-115
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/CommandPalette.tsx
// component=CommandPalette
import figma from "figma";

// The palette's input, groups and rows come from the app's commands, projects and threads;
// __root.tsx mounts it once around the app.
export default {
  example: figma.tsx`<CommandPalette>{children}</CommandPalette>`,
  imports: ['import { CommandPalette } from "~/components/CommandPalette";'],
  id: "command",
};
