// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=244-382
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/bots/SidebarV2BotCardBody.tsx
// component=SidebarV2BotGridBody
import figma from "figma";

// A Petal's tile in the Petals grid (Sidebar.tsx): name, mascot and status come from its thread.
export default {
  example: figma.tsx`<SidebarV2BotGridBody
  shell={thread.source}
  mood={botMood}
  status={topStatus}
  seed={threadKey}
  name={thread.title}
  renameField={isRenaming ? title : null}
  regenerating={isRegeneratingTitle}
  sweepBadge={isSwept ? sweepBadge : null}
/>`,
  imports: ['import { SidebarV2BotGridBody } from "~/custom/bots/SidebarV2BotCardBody";'],
  id: "petal-tile",
};
