// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=91-738
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/SidebarV2StatusIndicator.tsx
// component=SidebarV2StatusMark
import figma from "figma";

// A row hands its thread's top status here; each kit status is one kind of it. Working's rain
// and bead frames are the same mark mid-animation.
const status = figma.selectedInstance.getEnum("Status", {
  Completed: "done",
  "Needs attention": "input",
  "Working · Rain 1": "working",
  "Working · Rain 2": "working",
  "Working · Rain 3": "working",
  "Working · Bead 1": "working",
  "Working · Bead 2": "working",
  "Working · Bead 3": "working",
  "Working · Still": "still",
  Failed: "failed",
  Monitoring: "monitoring",
  "Needs approval": "approval",
  Woke: "woke",
  Idle: "idle",
  "Idle · dot": "dot",
  Draft: "draft",
});
// Working · Still is the working mark drawn without motion, as status chips inside a message use it.
const still = status === "still";
const kind = still ? "working" : status;
const kinded = kind !== undefined && !["idle", "dot", "draft"].includes(kind);
const statusProp = kinded ? `{sidebarV2CardTopStatus("${kind}", { goalActive: false })}` : "{null}";
const idle = status === "dot" || status === "draft" ? ` idle="${status}"` : still ? " still" : "";

export default {
  example: figma.tsx`<SidebarV2StatusMark status=${statusProp} seed={threadKey}${idle} />`,
  imports: [
    'import { SidebarV2StatusMark } from "~/custom/SidebarV2StatusIndicator";',
    ...(kinded ? ['import { sidebarV2CardTopStatus } from "~/custom/sidebarV2CardStatus";'] : []),
  ],
  id: "thread-status",
  metadata: { nestable: true },
};
