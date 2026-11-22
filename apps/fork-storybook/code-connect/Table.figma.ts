// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=52-81
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/scheduled/ScheduledRunsTable.tsx
// component=ScheduledRunRows
import figma from "figma";

// The kit's table is the Automations runs list (ScheduledPage.tsx); its rows are the runs.
export default {
  example: figma.tsx`<Table>
  <ScheduledRunsHeader showTask />
  <ScheduledRunRows
    environmentId={environmentId}
    showTask
    taskTitles={taskTitles}
    refreshKey={refreshKey}
  />
</Table>`,
  imports: [
    'import { Table } from "~/components/ui/table";',
    'import { ScheduledRunRows, ScheduledRunsHeader } from "~/custom/scheduled/ScheduledRunsTable";',
  ],
  id: "table",
};
