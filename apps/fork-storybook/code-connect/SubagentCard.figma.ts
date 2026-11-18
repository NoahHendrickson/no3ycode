// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=99-1032
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/ForkSubagentGroup.tsx
// component=ForkSubagentCardView
import figma from "figma";

// The timeline draws this card for each subagent item (ForkSubagentGroup). The view takes the
// resolved ForkSubagentTreeRow, so the snippet emits a complete one with the card's text.
const card = figma.selectedInstance;
const status = card.getEnum("Status", {
  Working: { status: "running", mark: "working", label: "Running", activity: "Now", done: false },
  Completed: {
    status: "completed",
    mark: "done",
    label: "Completed",
    activity: "Result",
    done: true,
  },
  Failed: { status: "failed", mark: "failed", label: "Failed", activity: "Result", done: true },
  Stopped: {
    status: "cancelled",
    mark: "stopped",
    label: "Stopped",
    activity: "Result",
    done: true,
  },
}) ?? { status: "running", mark: "working", label: "Running", activity: "Now", done: false };
const open = card.getEnum("Open", { Yes: true }) ?? false;
const hasThread = card.getBoolean("Open thread");

// The provider comes from the swapped mark's own connection (providers.figma.batch.ts).
const mark = card.getInstanceSwap("Provider");
const markId = mark && mark.type === "INSTANCE" ? mark.codeConnectId() : null;
const driver = markId?.startsWith("provider-") ? markId.slice("provider-".length) : "codex";

const activity = card.getString("Activity");
// A bare path (no spaces) truncates in the middle; anything else is prose (forkSubagentTree.ts).
const shape = /\s/u.test(activity) ? "prose" : "path";
const model = card.getString("Model").toLowerCase().replace(/\s+/gu, "-");

export default {
  example: figma.tsx`<ForkSubagentCardView
  member={{
    id: "subagent-1",
    title: ${JSON.stringify(card.getString("Title"))},
    status: "${status.status}",
    mark: "${status.mark}",
    statusLabel: "${status.label}",
    model: ${JSON.stringify(model)},
    startedAt: "2026-11-18T12:00:00.000Z",
    completedAt: ${status.done ? '"2026-11-18T12:02:27.000Z"' : "null"},
    childThreadId: ${hasThread ? "childThreadId" : "null"},
    remote: undefined,
    driver: ProviderDriverKind.make("${driver}"),
    providerInstanceId: ProviderInstanceId.make("${driver}"),
    prompt: ${JSON.stringify(card.getString("Task"))},
    activity: { label: "${status.activity}", text: ${JSON.stringify(activity)}, shape: "${shape}" },
  }}
  environmentId={environmentId}
  open={${open}}
  onToggle={toggle}
  openThread={${hasThread ? "openThread" : "null"}}
/>`,
  imports: [
    'import { ProviderDriverKind, ProviderInstanceId } from "@t3tools/contracts";',
    'import { ForkSubagentCardView } from "~/custom/ForkSubagentGroup";',
  ],
  id: "subagent-card",
};
