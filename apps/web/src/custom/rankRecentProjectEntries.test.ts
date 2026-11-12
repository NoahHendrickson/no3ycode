import { EnvironmentId, ProjectId, ScheduledTaskId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { rankRecentProjectEntries } from "../components/Sidebar.logic";
import { makeThreadFixture } from "../test-fixtures";
import type { Thread } from "../types";

const environmentId = EnvironmentId.make("environment-test");

function entry(name: string) {
  return {
    group: {
      id: name,
      title: name,
      projectKey: `key:${name}`,
      memberProjectRefs: [{ environmentId, projectId: ProjectId.make(name) }],
    },
  };
}

function thread(project: string, day: number, overrides: Partial<Thread> = {}): Thread {
  const at = `2026-11-0${day}T12:00:00.000Z`;
  return makeThreadFixture({
    id: ThreadId.make(`${project}-${day}-${overrides.lineage ? "child" : "root"}`),
    environmentId,
    projectId: ProjectId.make(project),
    updatedAt: at,
    latestUserMessageAt: at,
    ...overrides,
  });
}

const subagentOf = (project: string): Partial<Thread> => ({
  lineage: {
    rootThreadId: ThreadId.make(`${project}-root`),
    parentThreadId: ThreadId.make(`${project}-root`),
    relationshipToParent: "subagent",
  },
});

const ranked = (entries: ReturnType<typeof entry>[], threads: Thread[], limit = 5) =>
  rankRecentProjectEntries(entries, threads, limit).map((ranked) => ranked.group.title);

describe("rankRecentProjectEntries", () => {
  it("ranks newest activity first and stops at the limit", () => {
    const entries = ["alpha", "beta", "gamma"].map(entry);
    const threads = [thread("alpha", 1), thread("beta", 3), thread("gamma", 2)];
    expect(ranked(entries, threads)).toEqual(["beta", "gamma", "alpha"]);
    expect(ranked(entries, threads, 2)).toEqual(["beta", "gamma"]);
  });

  it("leaves out projects with no thread the sidebar shows", () => {
    const automationRun = thread("gamma", 4);
    expect(
      ranked(["alpha", "beta", "gamma", "delta"].map(entry), [
        thread("alpha", 1),
        thread("beta", 2, { archivedAt: "2026-11-02T13:00:00.000Z" }),
        {
          ...automationRun,
          source: { ...automationRun.source, scheduledTaskId: ScheduledTaskId.make("task") },
        },
      ]),
    ).toEqual(["alpha"]);
  });

  it("orders by the visible threads, not hidden subagents or automation runs", () => {
    const automationRun = thread("beta", 5);
    expect(
      ranked(["alpha", "beta", "gamma"].map(entry), [
        thread("alpha", 1),
        thread("alpha", 4, subagentOf("alpha")),
        thread("beta", 2),
        {
          ...automationRun,
          source: { ...automationRun.source, scheduledTaskId: ScheduledTaskId.make("task") },
        },
        thread("gamma", 3),
      ]),
    ).toEqual(["gamma", "beta", "alpha"]);
  });
});
