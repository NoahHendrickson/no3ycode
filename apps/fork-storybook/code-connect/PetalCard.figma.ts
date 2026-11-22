// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=72-651
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/bots/SidebarV2BotCardBody.tsx
// component=SidebarV2BotCardBody
import figma from "figma";

// A Petal's row in the sidebar (Sidebar.tsx): name, report, mascot and status come from the
// Petal's thread and its work.
export default {
  example: figma.tsx`<SidebarV2BotCardBody
  environmentId={thread.environmentId}
  threadId={thread.id}
  shell={thread.source}
  status={status}
  isUnread={isUnread}
  work={botWork}
  mood={botMood}
  title={title}
  trailing={trailingGroup}
/>`,
  imports: ['import { SidebarV2BotCardBody } from "~/custom/bots/SidebarV2BotCardBody";'],
  id: "petal-card",
};
