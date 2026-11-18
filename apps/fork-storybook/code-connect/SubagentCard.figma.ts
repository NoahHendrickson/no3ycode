// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=99-1032
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/ForkSubagentGroup.tsx
// component=ForkSubagentGroup
import figma from "figma";

// The timeline renders every subagent item through ForkSubagentGroup (TimelineV2EventRow), and the
// card's status, open state, elapsed time and model all come from that row, so the snippet is the
// call itself rather than a hand-built copy of the row.
export default {
  example: figma.tsx`<ForkSubagentGroup row={row} environmentId={environmentId} onOpenThread={onOpenThread} />`,
  imports: ['import { ForkSubagentGroup } from "~/custom/ForkSubagentGroup";'],
  id: "subagent-card",
};
