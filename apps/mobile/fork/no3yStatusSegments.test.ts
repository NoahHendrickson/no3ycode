import { describe, expect, it } from "vite-plus/test";

import {
  no3yElapsedLabel,
  no3ySubagentMarkKind,
  no3yStatusSegments,
  type No3yStatusPillInput,
} from "./no3yStatusSegments";

const idle: No3yStatusPillInput = {
  status: null,
  pullRequest: false,
  backgroundKinds: [],
  subagents: null,
  childInputCount: 0,
  extension: false,
  queuedCount: 0,
  deviceCount: 0,
  browserCount: 0,
};

const summary = (input: Partial<No3yStatusPillInput>) =>
  no3yStatusSegments({ ...idle, ...input }).map((segment) => {
    if (segment.kind === "status") return segment.needsYou ? "status!" : "status";
    if (segment.kind === "pullRequest" || segment.kind === "extension") return segment.kind;
    return `${segment.kind}:${segment.count}${segment.needsYou ? "!" : ""}${segment.quiet ? "~" : ""}`;
  });

describe("no3y status pill segments", () => {
  it("shows nothing when the thread is quiet", () => {
    expect(summary({})).toEqual([]);
  });

  it("counts background processes and monitors, and leaves the working turn to the transcript", () => {
    const working = { kind: "working", startedAt: "2026-11-22T00:00:00.000Z" } as const;
    expect(summary({ status: working, backgroundKinds: ["command", "background_task"] })).toEqual([
      "processes:2",
    ]);
    expect(summary({ backgroundKinds: ["monitor", "monitor"] })).toEqual(["monitors:2"]);
    // A running turn with nothing else going on draws no pill at all.
    expect(summary({ status: working })).toEqual([]);
  });

  it("folds the background status into its item segments", () => {
    const action = {
      label: "Stop",
      accessibilityLabel: "Stop",
      disabled: false,
      onPress: () => {},
    };
    expect(
      summary({
        status: {
          kind: "background",
          label: "Running · npm run dev",
          accessibilityLabel: "Running",
          waiting: false,
          onPress: () => {},
          action,
        },
        backgroundKinds: ["command"],
      }),
    ).toEqual(["processes:1"]);
  });

  it("counts live subagents, dims finished ones, and flags a child waiting on the user", () => {
    expect(summary({ subagents: { live: 2, total: 3 } })).toEqual(["subagents:2"]);
    expect(summary({ subagents: { live: 0, total: 3 } })).toEqual(["subagents:3~"]);
    expect(summary({ subagents: { live: 0, total: 3 }, childInputCount: 1 })).toEqual([
      "subagents:3!",
    ]);
    // A child from an earlier turn still gets a robot segment to reach it.
    expect(summary({ childInputCount: 2 })).toEqual(["subagents:2!"]);
    expect(summary({ backgroundKinds: ["subagent"] })).toEqual(["subagents:1"]);
  });

  it("flags connection loss and an unresponsive stop as needing the user", () => {
    expect(
      summary({
        status: { kind: "connection", tone: "unavailable", label: "Offline", onPress: () => {} },
      }),
    ).toEqual(["status!"]);
    expect(
      summary({
        status: { kind: "connection", tone: "reconnecting", label: "Retrying", onPress: () => {} },
      }),
    ).toEqual(["status"]);
    expect(
      summary({
        status: { kind: "stop", label: "Not responding", unresponsive: true, action: null },
      }),
    ).toEqual(["status!"]);
  });

  it("groups two or more kinds of background work into one pill, keeping a lone kind as itself", () => {
    const offline = {
      kind: "connection",
      tone: "unavailable",
      label: "Offline",
      onPress: () => {},
    } as const;
    expect(
      summary({
        status: offline,
        pullRequest: true,
        backgroundKinds: ["command", "monitor"],
        subagents: { live: 2, total: 2 },
        childInputCount: 1,
        browserCount: 1,
      }),
    ).toEqual(["status!", "pullRequest", "backgroundGroup:4!", "browser:1"]);
    // Finished subagents are not running work: they keep their own quiet pill beside a monitor,
    // and a child request marks that pill rather than inflating a group.
    expect(summary({ backgroundKinds: ["monitor"], subagents: { live: 0, total: 3 } })).toEqual([
      "monitors:1",
      "subagents:3~",
    ]);
    expect(
      summary({
        backgroundKinds: ["monitor"],
        subagents: { live: 0, total: 3 },
        childInputCount: 1,
      }),
    ).toEqual(["monitors:1", "subagents:3!"]);
    // Grouped processes and monitors leave a child request on its own subagents pill.
    expect(summary({ backgroundKinds: ["command", "monitor"], childInputCount: 1 })).toEqual([
      "backgroundGroup:2",
      "subagents:1!",
    ]);
  });

  it("keeps extension, queue and previews reachable as their own segments", () => {
    expect(
      summary({
        status: { kind: "extension", label: "Pi · ok", onPress: () => {} },
        queuedCount: 2,
        deviceCount: 1,
        browserCount: 3,
      }),
    ).toEqual(["extension", "queue:2", "devices:1", "browser:3"]);
  });
});

describe("no3y subagent status mark", () => {
  it("reads like the Threads list: working, waiting, done, failed, idle, and needs-you first", () => {
    expect(
      ["pending", "running", "waiting", "completed", "failed", "cancelled", "idle"].map((status) =>
        no3ySubagentMarkKind(status),
      ),
    ).toEqual(["working", "working", "waiting", "done", "failed", null, null]);
    expect(no3ySubagentMarkKind("running", "approval")).toBe("approval");
  });
});

describe("no3y pill elapsed label", () => {
  it("stays short: seconds, then minutes, then hours and minutes", () => {
    const start = "2026-11-22T00:00:00.000Z";
    const at = (seconds: number) => no3yElapsedLabel(start, Date.parse(start) + seconds * 1_000);
    expect([at(-5), at(42), at(7 * 60 + 59), at(65 * 60)]).toEqual(["0s", "42s", "7m", "1h 5m"]);
  });
});
