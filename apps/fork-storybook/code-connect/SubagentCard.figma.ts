// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=99-1032
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/ForkSubagentGroup.tsx
// component=ForkSubagentCardView
import figma from "figma";

// The timeline draws this card for each subagent item (ForkSubagentGroup); the view takes the
// resolved row, so the snippet shows the row the card needs.
const card = figma.selectedInstance;
const status = card.getEnum("Status", {
  Working: { status: "running", mark: "working", label: "Running", activity: "Now" },
  Completed: { status: "completed", mark: "done", label: "Completed", activity: "Result" },
  Failed: { status: "failed", mark: "failed", label: "Failed", activity: "Result" },
  Stopped: { status: "cancelled", mark: "stopped", label: "Stopped", activity: "Result" },
}) ?? { status: "running", mark: "working", label: "Running", activity: "Now" };
const open = card.getEnum("Open", { Yes: true }) ?? false;
const hasThread = card.getBoolean("Open thread");

export default {
  example: figma.tsx`<ForkSubagentCardView
  member={{
    title: ${JSON.stringify(card.getString("Title"))},
    status: "${status.status}",
    mark: "${status.mark}",
    statusLabel: "${status.label}",
    prompt: ${JSON.stringify(card.getString("Task"))},
    activity: { label: "${status.activity}", text: ${JSON.stringify(card.getString("Activity"))}, shape: "prose" },
    model: ${JSON.stringify(card.getString("Model"))},
    // id, driver, providerInstanceId, startedAt, completedAt, childThreadId, remote
  }}
  environmentId={environmentId}
  open={${open}}
  onToggle={toggle}
  openThread={${hasThread ? "openThread" : "null"}}
/>`,
  imports: ['import { ForkSubagentCardView } from "~/custom/ForkSubagentGroup";'],
  id: "subagent-card",
};
