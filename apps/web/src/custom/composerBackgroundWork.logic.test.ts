import { describe, expect, it } from "vite-plus/test";

import {
  NodeId,
  type OrchestrationV2PendingBackgroundTask,
  type OrchestrationV2Subagent,
  ProviderDriverKind,
  ProviderInstanceId,
  RunId,
  ThreadId,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";

import { composerBackgroundWorkItems, glanceCommandLabel } from "./composerBackgroundWork.logic";

describe("glanceCommandLabel", () => {
  it.each([
    ["vp run dev --no-seed 2>&1", "vp run dev --no-seed"],
    [
      "cd /Users/noey/.t3-fork/worktrees/no3ycode/t3-f33837b7/apps/mobile && vp run dev:client 2>&1",
      "vp run dev:client",
    ],
    ['cd "/tmp/my dir"; cd app && npm test > out.log 2>&1', "npm test"],
    ["node server.js &>/dev/null &", "node server.js"],
    ["bun test", "bun test"],
    ["gh pr checks 410 | tee checks.txt", "gh pr checks 410 | tee checks.txt"],
    ["cd /tmp", "cd /tmp"],
    ['echo "literal >flag"', 'echo "literal >flag"'],
    ['echo \\" "literal >flag"', 'echo \\" "literal >flag"'],
    ['cd /tmp && printf "%s\\n" "don\'t stop" > out.log', 'printf "%s\\n" "don\'t stop"'],
    [
      'echo "don\'t $(printf \'%s\' "literal >flag")"',
      'echo "don\'t $(printf \'%s\' "literal >flag")"',
    ],
    ["cd /tmp&&make&&npm test", "make&&npm test"],
    ["npm test >test.log&&pwd", "npm test >test.log&&pwd"],
    ["vp run dev &", "vp run dev"],
  ])("%s → %s", (command, expected) => {
    expect(glanceCommandLabel(command)).toBe(expected);
  });
});

describe("composerBackgroundWorkItems", () => {
  const live = RunId.make("run-live");
  const settled = RunId.make("run-settled");
  const runs = [
    { id: settled, status: "completed" as const },
    { id: live, status: "running" as const },
  ];
  const subagent = (
    id: string,
    patch: Partial<OrchestrationV2Subagent> = {},
  ): OrchestrationV2Subagent => ({
    id: NodeId.make(id),
    threadId: ThreadId.make("parent"),
    runId: live,
    parentNodeId: NodeId.make("parent-node"),
    origin: "app_owned",
    createdBy: "agent",
    driver: ProviderDriverKind.make("claudeAgent"),
    providerInstanceId: ProviderInstanceId.make("claudeAgent"),
    providerThreadId: null,
    childThreadId: ThreadId.make(`child-${id}`),
    nativeTaskRef: null,
    prompt: id,
    title: `Audit ${id}`,
    model: null,
    status: "running",
    result: null,
    startedAt: null,
    completedAt: null,
    updatedAt: DateTime.makeUnsafe("2026-11-24T00:00:00.000Z"),
    ...patch,
  });
  const ids = (items: ReturnType<typeof composerBackgroundWorkItems>) =>
    items.map((item) => [item.taskId, item.childThreadId ?? null, item.subagent?.id ?? null]);

  it("adds a live run's own subagents, each matched to its record once", () => {
    const pending: ReadonlyArray<OrchestrationV2PendingBackgroundTask> = [
      { taskId: "dev", kind: "command", description: "vp run dev" },
      { taskId: "t-a", kind: "subagent", childThreadId: ThreadId.make("child-a") },
      // A native task carries only its id; its record lends it the child thread to open.
      { taskId: "native-n", kind: "subagent" },
    ];
    const agents = [
      subagent("a", { runId: settled }),
      subagent("n", {
        nativeTaskRef: {
          driver: ProviderDriverKind.make("muse"),
          nativeId: "native-n",
          strength: "strong",
        },
      }),
      subagent("b"),
      // A linked environment's delegation has no local child thread but still reads as a subagent.
      subagent("r", { childThreadId: null }),
      subagent("done", { status: "completed" }),
    ];
    expect(ids(composerBackgroundWorkItems(pending, agents, runs))).toEqual([
      ["t-a", "child-a", "a"],
      ["native-n", "child-n", "n"],
      ["b", "child-b", "b"],
      ["r", null, "r"],
      ["dev", null, null],
    ]);
  });

  it("trusts only the pending list once the run settles, so a record that lost its end clears", () => {
    const stale = [subagent("s", { runId: settled })];
    expect(composerBackgroundWorkItems([], stale, runs)).toEqual([]);
  });

  it("pairs a task with the live record when a follow-up reused its child thread", () => {
    const pending: ReadonlyArray<OrchestrationV2PendingBackgroundTask> = [
      { taskId: "first", kind: "subagent", childThreadId: ThreadId.make("child-1") },
    ];
    const agents = [
      subagent("first", { childThreadId: ThreadId.make("child-1"), status: "completed" }),
      subagent("follow-up", { childThreadId: ThreadId.make("child-1") }),
    ];
    expect(ids(composerBackgroundWorkItems(pending, agents, runs))).toEqual([
      ["first", "child-1", "follow-up"],
    ]);
  });
});
