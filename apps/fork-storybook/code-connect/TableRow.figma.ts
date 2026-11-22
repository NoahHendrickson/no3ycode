// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=52-75
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/table.tsx
// component=TableRow
import figma from "figma";

// ScheduledRunRows draws one row per run; its cells are that run's data.
const selected = figma.selectedInstance.getEnum("State", { Selected: true });

export default {
  example: figma.tsx`<TableRow${selected ? ' data-state="selected"' : ""}>{cells}</TableRow>`,
  imports: ['import { TableRow } from "~/components/ui/table";'],
  id: "table-row",
  metadata: { nestable: true },
};
