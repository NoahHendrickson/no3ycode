// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=327-886
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/chat/TimelineWorkGroupRows.tsx
// component=WorkingTimelineRow
import figma from "figma";

// The last row of a running turn; its label, timer and group toggle come from the working row.
export default {
  example: figma.tsx`<WorkingTimelineRow row={row} />`,
  imports: ['import { WorkingTimelineRow } from "~/components/chat/TimelineWorkGroupRows";'],
  id: "live-status-line",
};
