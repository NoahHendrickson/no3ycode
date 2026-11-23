import { describe, expect, it } from "vite-plus/test";
import {
  deriveMessagesTimelineRows,
  type MessagesTimelineRow,
} from "~/components/chat/MessagesTimeline.logic";
import {
  forkLiveStatusRows,
  forkStatusLineLabel,
  forkStatusLineRow,
  isForkStatusLine,
  type ForkLiveRow,
} from "./forkWorkingRowLast";

type Entries = Parameters<typeof deriveMessagesTimelineRows>[0]["timelineEntries"];

const at = (second: number) => `2026-01-01T00:00:${String(second).padStart(2, "0")}Z`;
const command = (id: string, second: number, status: "inProgress" | "completed" | "failed") => ({
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
const reasoning = (second: number) => {
  const work = command("thought", second, "inProgress");
  const { command: _command, requestKind: _requestKind, ...entry } = work.entry;
  return {
    ...work,
    entry: {
      ...entry,
      detail: entry.label,
      itemType: "reasoning" as const,
      tone: "thinking" as const,
    },
  };
};
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

  it("keeps a running tool in place, past commentary, above a Thinking line", () => {
    const rows = derive([command("first", 5, "inProgress"), commentary(6)]);
    expect(kinds(rows)).toEqual(["working", "work-live", "message"]);
    const result = forkLiveStatusRows(rows);
    expect(kinds(result)).toEqual(["work-live", "message", "working"]);
    const live = statusLine(result);
    expect(live?.kind === "thinking" && live.groupId).toBeUndefined();
  });

  it("draws a tool that already finished as settled, not running", () => {
    const rows = derive([command("first", 5, "completed")]);
    const live = rows.find((row) => row.kind === "work-live");
    expect(live?.active).toBe(true);
    const result = forkLiveStatusRows(rows);
    const tool = result.find((row) => row.kind === "work-live");
    expect(tool?.kind === "work-live" && tool.active).toBe(false);
    expect(statusLine(result)?.kind).toBe("thinking");
  });

  it("keeps an open group's toggle and details above the line", () => {
    const groupId = derive([command("first", 5, "inProgress")]).find(
      (row) => row.kind === "work-live",
    )?.groupId;
    const rows = derive([command("first", 5, "inProgress")], new Set([groupId!]));
    const result = forkLiveStatusRows(rows);
    expect(kinds(result).at(-1)).toBe("working");
    expect(result.some((row) => row.kind === "work-live" && row.expanded)).toBe(true);
    expect(statusLine(result)?.kind).toBe("thinking");
  });

  it("folds live reasoning into the line instead of doubling it", () => {
    const rows = derive([reasoning(5)]);
    expect(rows.some((row) => row.kind === "work-live" && row.entry.itemType === "reasoning")).toBe(
      true,
    );
    const result = forkLiveStatusRows(rows);
    expect(kinds(result)).toEqual(["working"]);
    expect(statusLine(result)?.kind).toBe("work-live");
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

describe("forkStatusLineRow", () => {
  const line = (rows: MessagesTimelineRow[]) => {
    const last = forkLiveStatusRows(rows).at(-1);
    return last?.kind === "working" ? last : undefined;
  };

  it("drops a running tool's Thinking line for Working for … while the turn waits on the user", () => {
    const working = line(derive([command("first", 5, "inProgress")]))!;
    expect(forkStatusLineRow(working, false)).toBe(working);
    expect(forkStatusLineRow(working, true)).toBeNull();
  });

  it("keeps a folded thinking row's line either way", () => {
    const working = line(derive([]))!;
    expect(forkStatusLineRow(working, true)).toBe(working);
  });
});

describe("forkStatusLineLabel", () => {
  const activity = { providerStartingLabel: null, liveAnswerPreview: null };
  const thinking = { kind: "thinking", id: "live", createdAt: null } as ForkLiveRow;
  const reasoning = {
    kind: "work-live",
    entry: { itemType: "reasoning" },
  } as unknown as ForkLiveRow;

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
    ["live reasoning", reasoning, activity, "Thinking"],
  ])("labels %s", (_, live, state, label) => {
    expect(forkStatusLineLabel(live, state)).toBe(label);
  });
});
