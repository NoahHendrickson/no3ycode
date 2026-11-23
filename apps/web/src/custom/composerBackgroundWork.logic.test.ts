import { describe, expect, it } from "vite-plus/test";

import { hasUnseenApproval, resolveCollapsedTaskIds } from "./composerBackgroundWork.logic";

describe("resolveCollapsedTaskIds", () => {
  it("holds a collapse until a task it has not seen starts, then stays spent", () => {
    const tasks = (...ids: string[]) => ids.map((taskId) => ({ taskId }));
    const collapsed = new Set(["monitor", "a"]);
    // A task ending keeps the collapse.
    expect(resolveCollapsedTaskIds(tasks("monitor"), collapsed)).toBe(collapsed);
    // One starting spends it, so the drawer stays open after that task ends too.
    const reopened = resolveCollapsedTaskIds(tasks("monitor", "subagent"), collapsed);
    expect(reopened).toBeNull();
    expect(resolveCollapsedTaskIds(tasks("monitor"), reopened)).toBeNull();
  });
});

describe("hasUnseenApproval", () => {
  it("is true only while an approval the drawer has not made way for is pending", () => {
    const ids = (...values: string[]) => new Set(values);
    expect(hasUnseenApproval(ids("a"), ids())).toBe(true);
    expect(hasUnseenApproval(ids("a"), ids("a"))).toBe(false);
    expect(hasUnseenApproval(ids("a", "b"), ids("a"))).toBe(true);
    expect(hasUnseenApproval(ids("b"), ids("a", "b"))).toBe(false);
  });
});
