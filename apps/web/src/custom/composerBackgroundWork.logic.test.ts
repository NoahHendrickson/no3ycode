import { describe, expect, it } from "vite-plus/test";

import {
  composerBackgroundTasks,
  glanceCommandLabel,
  resolveComposerBackgroundWork,
} from "./composerBackgroundWork.logic";

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

describe("resolveComposerBackgroundWork", () => {
  it("pairs a task with the live record when a follow-up reused its child thread", () => {
    const record = (id: string, status: string) =>
      ({ id, status, childThreadId: "child-1", title: id, prompt: id }) as never;
    const resolved = resolveComposerBackgroundWork(
      {
        title: "1 subagent",
        waiting: false,
        items: [
          {
            taskId: "task-2",
            kind: "subagent",
            label: "Follow-up",
            childThreadId: "child-1" as never,
          },
        ],
      },
      [record("first", "completed"), record("follow-up", "running")],
    );
    expect(resolved?.items[0]?.subagent?.id).toBe("follow-up");
  });
});

describe("composerBackgroundTasks", () => {
  const record = (id: string, status: string, childThreadId: string | null = `child-${id}`) =>
    ({ id, status, childThreadId, title: `Audit ${id}`, prompt: id }) as never;

  it("adds a live run's own subagents to the pending list, each once", () => {
    const command = { taskId: "dev", kind: "command", description: "vp run dev" } as never;
    const pending = { taskId: "t-a", kind: "subagent", childThreadId: "child-a" } as never;
    const native = { taskId: "native-n", kind: "subagent" } as never;
    const agents = [
      record("a", "running"),
      record("b", "running"),
      record("c", "completed"),
      { ...(record("n", "running", null) as object), nativeTaskRef: { nativeId: "native-n" } },
    ] as never;
    const listed = composerBackgroundTasks([command, pending, native], agents);
    expect(listed.map((task) => task.taskId)).toEqual(["dev", "t-a", "native-n", "b"]);
    expect(listed.at(-1)).toEqual({
      taskId: "b",
      kind: "subagent",
      description: "Audit b",
      childThreadId: "child-b",
    });
  });
});
