import { MessageId, RunId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import { deriveMessagesTimelineRows } from "~/components/chat/MessagesTimeline.logic";
import type { TimelineEntry } from "~/session-logic";
import { forkSubagentCardsAfterReply } from "./forkSubagentCardsAfterReply";

const runId = RunId.make("run-1");
const time = (second: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, second)).toISOString();
const message = (id: string, second: number, role: "user" | "assistant"): TimelineEntry => ({
  kind: "message",
  id,
  createdAt: time(second),
  message: {
    id: MessageId.make(id),
    role,
    text: id,
    runId,
    ...(role === "user" ? { inputIntent: "turn_start" as const } : {}),
    createdAt: time(second),
    updatedAt: time(second),
    streaming: false,
  },
});
const work = (id: string, second: number): TimelineEntry => ({
  kind: "work",
  id,
  createdAt: time(second),
  entry: { id, createdAt: time(second), runId, label: id, tone: "tool" },
});
// Native subagent work has no app run, so its card stays visible in a folded turn.
const subagent = (id: string, second: number, status: "completed" | "running"): TimelineEntry => ({
  kind: "event",
  id,
  createdAt: time(second),
  projectedItem: { item: { type: "subagent", status, runId: null } } as never,
});

function rows(
  entries: TimelineEntry[],
  { expanded = false, working = false }: { expanded?: boolean; working?: boolean } = {},
) {
  return deriveMessagesTimelineRows({
    timelineEntries: entries,
    latestRun: {
      runId,
      status: working ? "running" : "completed",
      startedAt: time(0),
      completedAt: working ? null : time(31),
    },
    isWorking: working,
    ...(working ? { activeTurnStartedAt: time(0) } : {}),
    expandedRunIds: expanded ? new Set([runId]) : new Set(),
    turnDiffSummaries: [],
    supportsConversationRollback: false,
  });
}

const ids = (list: ReturnType<typeof rows>) => list.map((row) => row.id);
const turn = (status: "completed" | "running" = "completed") => [
  message("prompt", 0, "user"),
  work("w1", 2),
  subagent("sub", 5, status),
  work("w2", 10),
  message("final", 30, "assistant"),
];

describe("forkSubagentCardsAfterReply", () => {
  it("moves a folded turn's finished subagent card below its reply", () => {
    const before = rows(turn());
    expect(ids(before)).toEqual(["prompt", `turn-fold:${runId}`, "sub", "final"]);
    expect(ids(forkSubagentCardsAfterReply(before))).toEqual([
      "prompt",
      `turn-fold:${runId}`,
      "final",
      "sub",
    ]);
  });

  it("keeps the order work happened in when the turn is expanded", () => {
    const expanded = rows(turn(), { expanded: true });
    expect(forkSubagentCardsAfterReply(expanded)).toBe(expanded);
  });

  it("leaves a subagent that is still running where it is", () => {
    const live = rows(turn("running"));
    expect(ids(live)).toContain("sub");
    expect(forkSubagentCardsAfterReply(live)).toBe(live);
  });

  it("keeps the same array while the rows are unchanged", () => {
    const before = rows(turn());
    expect(forkSubagentCardsAfterReply(before)).toBe(forkSubagentCardsAfterReply(before));
  });
});
