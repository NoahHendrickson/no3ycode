import { EnvironmentId, ProviderInstanceId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { countRunningSubagents } from "./runningSubagentCounts";

type Shell = Parameters<typeof countRunningSubagents>[0][number];

const env = EnvironmentId.make("env");
const runtime = (status: "running" | "idle" | "completed") => ({
  status,
  activeRunId: null,
  providerInstanceId: ProviderInstanceId.make("codex"),
  providerName: null,
  lastError: null,
});

const shell = (
  id: string,
  parent: string | null,
  overrides: Partial<Omit<Shell, "id" | "lineage">> & {
    readonly relationship?: "subagent" | null;
    readonly sideChat?: boolean;
  } = {},
): Shell => {
  const { relationship = parent === null ? null : "subagent", sideChat, ...rest } = overrides;
  return {
    id: ThreadId.make(id),
    environmentId: env,
    lineage: {
      parentThreadId: parent === null ? null : ThreadId.make(parent),
      relationshipToParent: relationship,
      rootThreadId: ThreadId.make("root"),
      ...(sideChat === undefined ? {} : { sideChat }),
    },
    delegatedFrom: null,
    archivedAt: null,
    runtime: runtime("running"),
    ...rest,
  };
};

describe("countRunningSubagents", () => {
  it("counts live subagents toward the row that stands in for them", () => {
    const counts = countRunningSubagents([
      shell("root", null, { runtime: runtime("idle") }),
      shell("a", "root"),
      shell("b", "root"),
      // Nested under a, so it counts toward root.
      shell("a1", "a"),
      // A side chat has no row, so its subagent counts toward root too.
      shell("side", "root", { relationship: null, sideChat: true, runtime: runtime("idle") }),
      shell("sideAgent", "side"),
      // A task delegated from a listed thread is a subagent of it.
      shell("task", null, {
        delegatedFrom: { environmentId: env, threadId: ThreadId.make("root"), title: "root" },
      }),
      shell("done", "root", { runtime: runtime("completed") }),
      shell("archived", "root", { archivedAt: "2026-11-24T00:00:00.000Z" }),
      shell("noRuntime", "root", { runtime: null }),
      // Its parent is missing: a broken chain resolves to no row, so nothing counts.
      shell("orphan", "missing"),
    ]);
    expect(Object.fromEntries(counts)).toEqual({ "env:root": 5 });
  });
});
