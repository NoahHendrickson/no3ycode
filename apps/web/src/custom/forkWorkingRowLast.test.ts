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
const command = (
  id: string,
  second: number,
  status: "inProgress" | "completed" | "failed" | undefined,
) => ({
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
    ...(status === undefined ? {} : { toolLifecycleStatus: status }),
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

  it("folds the tool stretch at the turn's tail into the line", () => {
    const rows = derive([command("first", 5, "completed"), command("second", 6, "inProgress")]);
    expect(kinds(rows)).toEqual(["working", "work-live"]);
    const result = forkLiveStatusRows(rows);
    expect(kinds(result)).toEqual(["working"]);
    const live = statusLine(result);
    expect(live?.kind === "work-live" && live.active && live.entry.id).toBe("second");
  });

  it("keeps a running tool in place, past commentary, above a Thinking line", () => {
    const rows = derive([command("first", 5, "inProgress"), commentary(6)]);
    expect(kinds(rows)).toEqual(["working", "work-live", "message"]);
    const result = forkLiveStatusRows(rows);
    expect(kinds(result)).toEqual(["work-live", "message", "working"]);
    expect(statusLine(result)).toBeNull();
  });

  it("seeds the thinking word from what last landed, so it holds until something new does", () => {
    const seed = (entries: Entries) => {
      const last = forkLiveStatusRows(derive(entries)).at(-1);
      return last?.kind === "working" && isForkStatusLine(last) ? last.forkWordSeed : undefined;
    };
    const running = seed([command("first", 5, "inProgress")]);
    expect(seed([command("first", 5, "inProgress")])).toBe(running);
    expect(seed([command("first", 5, "completed"), command("second", 6, "inProgress")])).not.toBe(
      running,
    );
    expect(seed([reasoning(5)])).toBe("thought");
  });

  it("keeps a tool with no lifecycle status running, as upstream does", () => {
    const rows = derive([command("first", 5, undefined)]);
    expect(rows.find((row) => row.kind === "work-live")?.active).toBe(true);
    const tool = statusLine(forkLiveStatusRows(rows));
    expect(tool?.kind === "work-live" && tool.active).toBe(true);
  });

  it("draws a tool that already finished as settled, not running", () => {
    const rows = derive([command("first", 5, "completed")]);
    const live = rows.find((row) => row.kind === "work-live");
    expect(live?.active).toBe(true);
    const result = forkLiveStatusRows(rows);
    expect(kinds(result)).toEqual(["working"]);
    const tool = statusLine(result);
    expect(tool?.kind === "work-live" && tool.active).toBe(false);
  });

  it("keeps an open group's details above the line, which holds its toggle", () => {
    const groupId = derive([command("first", 5, "inProgress")]).find(
      (row) => row.kind === "work-live",
    )?.groupId;
    const rows = derive([command("first", 5, "inProgress")], new Set([groupId!]));
    const result = forkLiveStatusRows(rows);
    expect(kinds(result)).toEqual(["work", "working"]);
    const live = statusLine(result);
    expect(live?.kind === "work-live" && live.expanded).toBe(true);
  });

  it("leaves reasoning a reply followed in the trail and folds the thinking row", () => {
    const result = forkLiveStatusRows(derive([reasoning(5), commentary(6)]));
    expect(kinds(result)).toEqual(["work", "message", "working"]);
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

  it("adds no second Thinking line when a failed group follows a tool still running", () => {
    const rows = derive([
      command("first", 5, "inProgress"),
      commentary(6),
      command("second", 7, "failed"),
    ]);
    expect(rows.some((row) => row.kind === "work-live" && row.active)).toBe(true);
    expect(rows.some((row) => row.kind === "thinking" && row.groupId !== undefined)).toBe(true);
    const result = forkLiveStatusRows(rows);
    expect(result.filter((row) => row.kind === "thinking")).toHaveLength(1);
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

describe("forkLiveStatusRows while the line yields the tail", () => {
  it.each([
    ["a running tool", [command("first", 5, "inProgress")], ["work-live", "working"]],
    ["the thinking row", [], ["thinking", "working"]],
  ])("leaves %s in place above Working for …", (_, entries, expected) => {
    const result = forkLiveStatusRows(derive(entries), true);
    expect(kinds(result)).toEqual(expected);
    const last = result.at(-1);
    expect(last?.kind === "working" && isForkStatusLine(last)).toBe(false);
  });

  it("keeps an open group's toggle above its details", () => {
    const groupId = derive([command("first", 5, "inProgress")]).find(
      (row) => row.kind === "work-live",
    )?.groupId;
    const rows = derive([command("first", 5, "inProgress")], new Set([groupId!]));
    expect(kinds(forkLiveStatusRows(rows, true))).toEqual(["work-live", "work", "working"]);
  });
});

describe("forkStatusLineLabel", () => {
  const activity = { providerStartingLabel: null, liveAnswerPreview: null };
  const thinking = { kind: "thinking", id: "live", createdAt: null } as ForkLiveRow;
  const reasoning = {
    kind: "work-live",
    active: true,
    entry: { itemType: "reasoning" },
  } as unknown as ForkLiveRow;
  const tool = (status: "inProgress" | "completed") =>
    statusLine(forkLiveStatusRows(derive([command("first", 5, status)]))) ?? null;

  it.each([
    ["the thinking line", thinking, activity, null],
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
    ["live reasoning", reasoning, activity, null],
    ["a running tool", tool("inProgress"), activity, "Running rg"],
    ["a settled tool", tool("completed"), activity, null],
    ["the line under a tool that stays in place", null, activity, null],
  ])("labels %s", (_, live, state, label) => {
    expect(forkStatusLineLabel(live, state, undefined)).toBe(label);
  });
});
