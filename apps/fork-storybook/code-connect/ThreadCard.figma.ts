// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=54-1391
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/Sidebar.tsx
// component=SidebarThreadRow
import figma from "figma";

import { attrs } from "./shared";

// The sidebar's thread card. Title, project, branch, PR, model, elapsed time and status all come
// from `thread`; the row is private to Sidebar.tsx, so this is its call there, with no import.
const card = figma.selectedInstance;

export default {
  example: figma.tsx`<SidebarThreadRow
  thread={thread}
  variant="card"
  isPinned={thread.pinnedAt != null}${attrs(
    card.getEnum("State", { Selected: "\n  isActive" }),
    card.getEnum("Compact", { Yes: "\n  compact" }),
  )}
  /* …and the list's section, capability, action and rename props */
/>`,
  imports: [],
  id: "thread-card",
};
