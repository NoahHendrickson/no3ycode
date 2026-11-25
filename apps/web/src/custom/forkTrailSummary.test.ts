import { describe, expect, it } from "vite-plus/test";
import {
  deriveMessagesTimelineRows,
  type MessagesTimelineRow,
} from "~/components/chat/MessagesTimeline.logic";
import type { TimelineEntry, WorkLogEntry } from "~/session-logic";

const at = (second: number) => `2026-01-01T00:00:${String(second).padStart(2, "0")}Z`;
const work = (
  id: string,
  second: number,
  entry: Pick<WorkLogEntry, "tone"> & Partial<WorkLogEntry>,
): TimelineEntry => ({
  id: `${id}-entry`,
  kind: "work",
  createdAt: at(second),
  entry: {
    id,
    label: id,
    createdAt: at(second),
    runId: "turn-1" as never,
    toolLifecycleStatus: "completed",
    ...entry,
  },
});
const thought = (second: number) =>
  work("thought", second, { detail: "thought", itemType: "reasoning", tone: "thinking" });
const tasks = (second: number) => work("tasks", second, { itemType: "todo_list", tone: "info" });
const read = (second: number) =>
  work("read", second, { requestKind: "file-read", itemType: "dynamic_tool", tone: "tool" });
const reply = (second: number): TimelineEntry => ({
  id: "reply-entry",
  kind: "message",
  createdAt: at(second),
  message: {
    id: "reply" as never,
    role: "assistant",
    text: "reply",
    runId: "turn-1" as never,
    createdAt: at(second),
    updatedAt: at(second),
    streaming: false,
  },
});

function trail(timelineEntries: TimelineEntry[]): MessagesTimelineRow[] {
  return deriveMessagesTimelineRows({
    timelineEntries,
    latestRun: { runId: "turn-1" as never, status: "running", startedAt: at(0), completedAt: null },
    isWorking: true,
    activeTurnStartedAt: at(0),
    turnDiffSummaries: [],
    supportsConversationRollback: false,
  }).filter((row) => row.kind !== "working" && row.kind !== "thinking");
}
const summaryOf = (row: MessagesTimelineRow | undefined) =>
  row?.kind === "work-toggle" ? row.summary : undefined;

describe("fork trail summary", () => {
  it("folds a thought, a task update and a tool into one row named for the tool", () => {
    const rows = trail([thought(1), tasks(2), read(3), reply(4)]);
    expect(rows.map((row) => row.kind)).toEqual(["work-toggle", "message"]);
    expect(summaryOf(rows[0])).toMatch(/^Read /u);
  });

  it("keeps a group with an unfinished task update settled", () => {
    const running = work("tasks", 2, {
      itemType: "todo_list",
      tone: "info",
      toolLifecycleStatus: "inProgress",
    });
    const rows = trail([thought(1), running, read(3), reply(4)]);
    expect(rows.map((row) => row.kind)).toEqual(["work-toggle", "message"]);
    expect(summaryOf(rows[0])).toMatch(/^Read /u);
  });

  it("names a lone thought, not its text", () => {
    expect(summaryOf(trail([thought(1), reply(2)])[0])).toBe("Thought");
  });

  it("keeps a task update that starts a stretch as its own row", () => {
    const rows = trail([tasks(1), read(2), reply(3)]);
    expect(rows.map((row) => row.kind)).toEqual(["work", "work", "message"]);
  });
});
