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

const activity = card.getString("Activity").trim();
// A path (a slash, no spaces) truncates in the middle; anything else is prose (forkSubagentTree.ts).
const shape = activity.includes("/") && !activity.includes(" ") ? "path" : "prose";
const activityRow = activity
  ? `{ label: "${status.activity}", text: ${JSON.stringify(activity)}, shape: "${shape}" }`
  : "null";
// The model as the card shows it; formatForkSubagentModel passes a display name through.
const model = card.getString("Model");

// The sample times reproduce the card's Elapsed text ("2m 27s"): a working card started that long
// before it was first shown, fixed once (a start recomputed per render would reset the timer);
// a settled one ran exactly that long.
const parts = [...card.getString("Elapsed").matchAll(/(\d+)\s*([hms])/gu)];
const elapsedMs =
  parts.length === 0
    ? 147_000
    : parts.reduce(
        (sum, [, amount, unit]) =>
          sum + Number(amount) * (unit === "h" ? 3_600_000 : unit === "m" ? 60_000 : 1_000),
        0,
      );
const settledStart = Date.parse("2026-11-18T12:00:00.000Z");
const startedAt = status.done
  ? JSON.stringify(new Date(settledStart).toISOString())
  : `useState(() => new Date(Date.now() - ${elapsedMs}).toISOString())[0]`;
const completedAt = status.done
  ? JSON.stringify(new Date(settledStart + elapsedMs).toISOString())
  : "null";

export default {
  example: figma.tsx`<ForkSubagentCardView
  member={{
    id: "subagent-1",
    title: ${JSON.stringify(card.getString("Title"))},
    status: "${status.status}",
    mark: "${status.mark}",
    statusLabel: "${status.label}",
    model: ${JSON.stringify(model)},
    startedAt: ${startedAt},
    completedAt: ${completedAt},
    childThreadId: ${hasThread ? "childThreadId" : "null"},
    remote: undefined,
    driver: ProviderDriverKind.make("${driver}"),
    providerInstanceId: ProviderInstanceId.make("${driver}"),
    prompt: ${JSON.stringify(card.getString("Task"))},
    activity: ${activityRow},
  }}
  environmentId={environmentId}
  open={${open}}
  onToggle={toggle}
  openThread={${hasThread ? "openThread" : "null"}}
/>`,
  imports: [
    ...(status.done ? [] : ['import { useState } from "react";']),
    'import { ProviderDriverKind, ProviderInstanceId } from "@t3tools/contracts";',
    'import { ForkSubagentCardView } from "~/custom/ForkSubagentGroup";',
  ],
  id: "subagent-card",
};
