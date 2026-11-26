import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import type { HomeProjectScope } from "../src/features/home/homeThreadList";
import { makeThreadShellFixture } from "../src/test-fixtures";
import {
  no3yCollapsedRowTranslateY,
  no3yExpandScrollOffset,
  no3yRowVisibleForCollapse,
  rankNo3yProjectTiles,
} from "./no3yProjectTiles";

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
    ...overrides,
  }).map((tile) => tile.scope.key);

describe("no3y New agent project rows", () => {
  it("lists every project: roster-active ones newest first, then the rest in order", () => {
    expect(rank()).toEqual(["c", "b", "a", "d"]);
    expect(rank({ threads: [] })).toEqual(["a", "b", "c", "d"]);
  });

  it("narrows to every match when searching", () => {
    expect(rank({ searchQuery: "d" })).toEqual(["d"]);
  });

  it("maps any scrolled row to the top dropdown slot, clamps expand scroll, and bounds offscreen rows", () => {
    expect(
      no3yCollapsedRowTranslateY({ rowIndex: 0, scrollY: 0, headerOffset: 26, rowPitch: 56 }),
    ).toBe(-26);
    expect(
      no3yCollapsedRowTranslateY({ rowIndex: 7, scrollY: 300, headerOffset: 26, rowPitch: 56 }),
    ).toBe(-118);

    const expand = (selectedIndex: number, rowCount = 15) =>
      no3yExpandScrollOffset({
        selectedIndex,
        rowCount,
        rowPitch: 56,
        rowGap: 8,
        topPadding: 20,
        headerOffset: 26,
        bottomInset: 260,
        viewportHeight: 700,
      });
    expect(expand(2)).toBe(0);
    expect(expand(8)).toBe(336);
    // Binding clamp near the end of the list excludes a trailing gap after the last row:
    // 20 + 26 + (10 * 56 - 8) + 260 - 700 = 158.
    expect(expand(9, 10)).toBe(158);

    expect(
      no3yRowVisibleForCollapse({
        rowIndex: 2,
        scrollY: 0,
        headerOffset: 26,
        rowPitch: 56,
        viewportHeight: 600,
      }),
    ).toBe(true);
    expect(
      no3yRowVisibleForCollapse({
        rowIndex: 20,
        scrollY: 0,
        headerOffset: 26,
        rowPitch: 56,
        viewportHeight: 600,
      }),
    ).toBe(false);
    expect(
      no3yRowVisibleForCollapse({
        rowIndex: 0,
        scrollY: 0,
        headerOffset: 26,
        rowPitch: 56,
        viewportHeight: 0,
      }),
    ).toBe(false);
  });
});
