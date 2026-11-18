import { describe, expect, it } from "vite-plus/test";
import {
  deriveMessagesTimelineRows,
  type MessagesTimelineRow,
} from "~/components/chat/MessagesTimeline.logic";
import {
  forkLiveStatusRows,
  forkStatusLineLabel,
  isForkStatusLine,
  type ForkLiveRow,
} from "./forkWorkingRowLast";

type Entries = Parameters<typeof deriveMessagesTimelineRows>[0]["timelineEntries"];

const at = (second: number) => `2026-01-01T00:00:${String(second).padStart(2, "0")}Z`;
const command = (id: string, second: number, status: "inProgress" | "failed") => ({
  id: `${id}-entry`,
  kind: "work" as const,
  createdAt: at(second),
  entry: {
    id,
    createdAt: at(second),
    runId: "turn-1" as never,
    label: `Running ${id}`,
    command: `rg ${id}`,
    requestKind: "command" as const,
    tone: "tool" as const,
    toolLifecycleStatus: status,
  },
});
const commentary = (second: number) => ({
  id: "commentary-entry",
  kind: "message" as const,
  createdAt: at(second),
  message: {
    id: "commentary" as never,
    role: "assistant" as const,
    text: "Starting another command.",
    runId: "turn-1" as never,
    createdAt: at(second),
    updatedAt: at(second),
    streaming: false,
  },
});

function derive(timelineEntries: Entries, expandedWorkGroupIds?: ReadonlySet<string>) {
  return deriveMessagesTimelineRows({
    timelineEntries,
    latestRun: {
      runId: "turn-1" as never,
      status: "running",
      startedAt: at(0),
      completedAt: null,
    },
    isWorking: true,
    activeTurnStartedAt: at(0),
    turnDiffSummaries: [],
    supportsConversationRollback: false,
    ...(expandedWorkGroupIds ? { expandedWorkGroupIds } : {}),
  });
}

const kinds = (rows: MessagesTimelineRow[]) => rows.map((row) => row.kind);
function statusLine(rows: MessagesTimelineRow[]) {
  const last = rows.at(-1);
  return last?.kind === "working" && isForkStatusLine(last) ? last.forkLive : undefined;
}

describe("forkLiveStatusRows", () => {
  it("folds the thinking line into the bottom status line", () => {
    const rows = derive([]);
    expect(kinds(rows)).toEqual(["working", "thinking"]);
    const result = forkLiveStatusRows(rows);
    expect(kinds(result)).toEqual(["working"]);
    expect(statusLine(result)?.kind).toBe("thinking");
  });

  it("folds the running tool, even past commentary that followed it", () => {
    const rows = derive([command("first", 5, "inProgress"), commentary(6)]);
    expect(kinds(rows)).toEqual(["working", "work-live", "message"]);
    const result = forkLiveStatusRows(rows);
    expect(kinds(result)).toEqual(["message", "working"]);
    expect(statusLine(result)?.kind).toBe("work-live");
  });

  it("folds only the latest of separated running tools", () => {
    const rows = derive([
      command("first", 5, "inProgress"),
      commentary(6),
      command("second", 7, "inProgress"),
    ]);
    const result = forkLiveStatusRows(rows);
    expect(kinds(result)).toEqual(["work-live", "message", "working"]);
    const live = statusLine(result);
    expect(live?.kind === "work-live" && live.entry.id).toBe("second");
  });

  it("keeps an open group's details above the folded line", () => {
    const groupId = derive([command("first", 5, "inProgress")]).find(
      (row) => row.kind === "work-live",
    )?.groupId;
    const rows = derive([command("first", 5, "inProgress")], new Set([groupId!]));
    const result = forkLiveStatusRows(rows);
    expect(kinds(result)).toEqual(["work", "working"]);
    expect(statusLine(result)?.expanded).toBe(true);
  });

  it("leaves a failed tool's grouped thinking row on its own line", () => {
    const rows = derive([command("first", 5, "failed")]);
    expect(rows.some((row) => row.kind === "thinking" && row.groupId !== undefined)).toBe(true);
    const result = forkLiveStatusRows(rows);
    expect(result.at(-2)?.kind).toBe("thinking");
    expect(statusLine(result)).toBeUndefined();
  });

  it("keeps row identity while the stable rows are unchanged", () => {
    const rows = derive([]);
    expect(forkLiveStatusRows(rows)).toBe(forkLiveStatusRows(rows));
    // A new array around the same rows reuses the merged row, so its frame skips a render.
    expect(forkLiveStatusRows([...rows]).at(-1)).toBe(forkLiveStatusRows(rows).at(-1));
    const idle = derive([]).filter((row) => row.kind !== "working");
    expect(forkLiveStatusRows(idle)).toBe(idle);
  });
});

describe("forkStatusLineLabel", () => {
  const activity = { providerStartingLabel: null, liveAnswerPreview: null };
  const thinking = { kind: "thinking", id: "live", createdAt: null } as ForkLiveRow;
  const tool = (itemType: string) =>
    ({ kind: "work-live", entry: { itemType } }) as unknown as ForkLiveRow;

  it.each([
    ["the thinking line", thinking, activity, "Thinking"],
    [
      "a provider startup",
      thinking,
      { ...activity, providerStartingLabel: "Starting session" },
      "Starting session",
    ],
    [
      "a zen answer preview",
      thinking,
      { ...activity, liveAnswerPreview: "Tiger cubs" },
      "Tiger cubs",
    ],
    ["a running tool", tool("command_execution"), activity, "Running rg"],
    ["live reasoning", tool("reasoning"), activity, "Thinking"],
  ])("labels %s", (_, live, state, label) => {
    expect(forkStatusLineLabel(live, state, "Running rg")).toBe(label);
  });
});
