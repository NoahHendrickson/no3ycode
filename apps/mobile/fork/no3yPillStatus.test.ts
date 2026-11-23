import { describe, expect, it } from "vite-plus/test";

import { no3yPillStatus, type No3yPillStatusInput } from "./no3yPillStatus";

const action = { label: "Stop", accessibilityLabel: "Stop", disabled: false, onPress: () => {} };
const idle: No3yPillStatusInput = {
  upstream: null,
  connectionState: "connected",
  open: true,
  compacting: false,
  workingSince: null,
  background: null,
  lifecycle: null,
};
const background = {
  label: "1 process",
  accessibilityLabel: "1 process",
  waiting: false,
  onPress: () => {},
  action,
};
const lifecycle = { state: "settled" as const, label: "Settled", action };
const childInput = {
  kind: "child-input" as const,
  label: "Question",
  accessibilityLabel: "Question",
  onPress: () => {},
};

describe("no3y pill status", () => {
  it.each<[string, Partial<No3yPillStatusInput>, string | null]>([
    ["nothing to show", {}, null],
    ["working", { workingSince: "2026-11-23T00:00:00.000Z" }, "working"],
    ["compacting over working", { compacting: true, workingSince: "x" }, "compacting"],
    ["working over background work", { workingSince: "x", background }, "working"],
    ["background work over snooze and settle", { background, lifecycle }, "background"],
    ["settled", { lifecycle }, "lifecycle"],
    [
      "a subagent's question over compacting",
      { upstream: childInput, compacting: true },
      "child-input",
    ],
    ["nothing while a request owns the slot", { open: false, workingSince: "x" }, null],
    [
      "upstream's goal once nothing of the pill's own is live",
      { upstream: { kind: "goal", label: "g", accessibilityLabel: "g", actions: [] } },
      "goal",
    ],
  ])("%s", (_name, input, kind) => {
    expect(no3yPillStatus({ ...idle, ...input })?.kind ?? null).toBe(kind);
  });

  it("keeps a connection problem first, and says whether it is still retrying", () => {
    const connection = { kind: "connection" as const, label: "Offline", onPress: () => {} };
    const busy = { ...idle, upstream: connection, workingSince: "x", open: false };
    expect(no3yPillStatus({ ...busy, connectionState: "reconnecting" })).toMatchObject({
      kind: "connection",
      tone: "reconnecting",
    });
    expect(no3yPillStatus({ ...busy, connectionState: "offline" })).toMatchObject({
      tone: "unavailable",
    });
  });
});
