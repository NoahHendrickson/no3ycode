// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=52-2
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/scheduled/ScheduledRunsTable.tsx
// component=ScheduledRunsHeader
import figma from "figma";

// `showTask` names the second column Automation (all runs) or Thread (one automation's runs).
export default {
  example: figma.tsx`<ScheduledRunsHeader showTask />`,
  imports: ['import { ScheduledRunsHeader } from "~/custom/scheduled/ScheduledRunsTable";'],
  id: "table-header",
  metadata: { nestable: true },
};
