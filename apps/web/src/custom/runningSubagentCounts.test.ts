import { describe, expect, it } from "vite-plus/test";

import { countRunningSubagents } from "./runningSubagentCounts";

type Shell = Parameters<typeof countRunningSubagents>[0][number];

const shell = (
  id: string,
  parent: string | null,
  overrides: Partial<Omit<Shell, "id" | "lineage">> = {},
): Shell =>
  ({
    id,
    environmentId: "env",
    lineage: {
      parentThreadId: parent,
      relationshipToParent: parent === null ? null : "subagent",
      rootThreadId: "root",
    },
    archivedAt: null,
    runtime: { status: "running" },
    ...overrides,
  }) as Shell;

describe("countRunningSubagents", () => {
  it("counts live subagents toward the listed thread at the top of their chain", () => {
    const counts = countRunningSubagents([
      shell("root", null, { runtime: { status: "idle" } as never }),
      shell("a", "root"),
      shell("b", "root"),
      // Nested under a, so it counts toward root, the row that stands in for it.
      shell("a1", "a"),
      shell("done", "root", { runtime: { status: "completed" } as never }),
      shell("archived", "root", { archivedAt: "2026-11-24T00:00:00.000Z" as never }),
      shell("waiting", "other", { runtime: { status: "waiting" } as never }),
      shell("noRuntime", "other", { runtime: null }),
    ]);
    expect(Object.fromEntries(counts)).toEqual({ "env:root": 3, "env:other": 1 });
  });
});
