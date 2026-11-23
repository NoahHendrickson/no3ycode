import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import type { HomeProjectScope } from "../src/features/home/homeThreadList";
import { makeThreadShellFixture } from "../src/test-fixtures";
import { rankNo3yProjectTiles } from "./no3yProjectTiles";

const ENV = EnvironmentId.make("env-1");

function scope(id: string): HomeProjectScope {
  const project = {
    environmentId: ENV,
    id: ProjectId.make(id),
    title: id,
    workspaceRoot: `/w/${id}`,
  } as EnvironmentProject;
  return {
    key: id,
    title: id,
    representative: project,
    projects: [project],
    projectRefs: [{ environmentId: ENV, projectId: project.id }],
    pinned: false,
    archived: false,
  };
}

function thread(
  id: string,
  projectId: string,
  at: string,
  overrides: Partial<EnvironmentThreadShell> = {},
): EnvironmentThreadShell {
  return makeThreadShellFixture({
    environmentId: ENV,
    id: ThreadId.make(id),
    projectId: ProjectId.make(projectId),
    title: id,
    createdAt: at,
    updatedAt: at,
    lastVisitedAt: at,
    latestUserMessageAt: at,
    latestUserAuthoredMessageAt: at,
    ...overrides,
  });
}

const scopes = ["a", "b", "c", "d"].map(scope);
const rank = (overrides: Partial<Parameters<typeof rankNo3yProjectTiles>[0]> = {}) =>
  rankNo3yProjectTiles({
    scopes,
    threads: [
      thread("t-a", "a", "2026-11-22T09:00:00.000Z"),
      thread("t-c", "c", "2026-11-22T11:00:00.000Z"),
      thread("t-b", "b", "2026-11-22T10:00:00.000Z"),
      // A chat in a real project never ranks it.
      thread("chat", "d", "2026-11-22T11:59:00.000Z", {
        source: { ...makeThreadShellFixture().source, tags: ["chat"] },
      }),
    ],
    sentChatKeys: new Set(),
    searchQuery: "",
    selectedScopeKey: null,
    limit: 8,
    ...overrides,
  }).map((tile) => tile.scope.key);

describe("no3y New agent project rows", () => {
  it("lists projects with roster threads, newest activity first", () => {
    expect(rank()).toEqual(["c", "b", "a"]);
    expect(rank({ limit: 2 })).toEqual(["c", "b"]);
  });

  it("keeps the selected project in the last place when it would not rank in", () => {
    expect(rank({ limit: 2, selectedScopeKey: "a" })).toEqual(["c", "a"]);
    expect(rank({ limit: 2, selectedScopeKey: "d" })).toEqual(["c", "d"]);
  });

  it("falls back to the first projects when none has a thread, and searches them all", () => {
    expect(rank({ threads: [] })).toEqual(["a", "b", "c", "d"]);
    expect(rank({ searchQuery: "d" })).toEqual(["d"]);
  });
});
