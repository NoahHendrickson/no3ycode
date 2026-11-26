import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import type { HomeProjectScope } from "../src/features/home/homeThreadList";
import { makeThreadShellFixture } from "../src/test-fixtures";
import {
  isNo3yProjectPickerExpanded,
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

  it("collapses once picked, and reopens for the dropdown or header search", () => {
    expect(
      isNo3yProjectPickerExpanded({ picked: false, pickerOpen: false, searchOpen: false }),
    ).toBe(true);
    expect(
      isNo3yProjectPickerExpanded({ picked: true, pickerOpen: false, searchOpen: false }),
    ).toBe(false);
    expect(isNo3yProjectPickerExpanded({ picked: true, pickerOpen: true, searchOpen: false })).toBe(
      true,
    );
    expect(isNo3yProjectPickerExpanded({ picked: true, pickerOpen: false, searchOpen: true })).toBe(
      true,
    );
  });

  it("maps any scrolled row to the top dropdown slot and bounds offscreen rows", () => {
    expect(
      no3yCollapsedRowTranslateY({ rowIndex: 0, scrollY: 0, headerOffset: 26, rowPitch: 56 }),
    ).toBe(-26);
    expect(
      no3yCollapsedRowTranslateY({ rowIndex: 7, scrollY: 300, headerOffset: 26, rowPitch: 56 }),
    ).toBe(-118);

    expect(
      no3yExpandScrollOffset({
        selectedIndex: 2,
        rowCount: 15,
        rowPitch: 56,
        topPadding: 20,
        headerOffset: 26,
        bottomInset: 260,
        viewportHeight: 700,
      }),
    ).toBe(0);
    expect(
      no3yExpandScrollOffset({
        selectedIndex: 8,
        rowCount: 15,
        rowPitch: 56,
        topPadding: 20,
        headerOffset: 26,
        bottomInset: 260,
        viewportHeight: 700,
      }),
    ).toBe(336);

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
  });
});
