import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { EnvironmentId, ProjectId, ProviderInstanceId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  buildCollapsedThreadTabs,
  collapsedDraftTabKey,
  collapsedFilterSwitchTarget,
  collapsedPaneTabs,
  collapsedTabProjectForScope,
  DEFAULT_COLLAPSED_TAB_STATUSES,
  fitCollapsedThreadTabs,
  layoutCollapsedTabRow,
  splitCollapsedTabsAroundPanes,
  type CollapsedThreadTabStatus,
} from "./collapsedThreadTabsModel";
import { buildSidebarDraftShell } from "./sidebarV2DraftRows";
import { createSidebarV2CompletedHoldTracker } from "./sidebarV2StatusGrouping";

const environmentId = EnvironmentId.make("local");
const NOW = "2026-01-02T00:00:00.000Z";
const running = {
  status: "running" as const,
  activeRunId: null,
  providerInstanceId: ProviderInstanceId.make("codex"),
  providerName: "Codex",
  lastError: null,
  updatedAt: NOW,
};

const shell = (id: string, projectId: string, createdAt: string) =>
  buildSidebarDraftShell({
    draft: {
      threadId: ThreadId.make(id),
      environmentId,
      projectId: ProjectId.make(projectId),
      logicalProjectKey: projectId,
      createdAt,
      runtimeMode: "full-access",
      interactionMode: "default",
      branch: "main",
      worktreePath: null,
      envMode: "local",
      startFromOrigin: false,
      promotedTo: null,
    },
    modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.4" },
  });

const project = (projectKey: string) => ({
  projectKey,
  displayName: projectKey,
  memberProjectRefs: [{ environmentId, projectId: projectKey }],
});

describe("buildCollapsedThreadTabs", () => {
  const threads = [
    { ...shell("asking", "p1", "2026-01-01T03:00:00.000Z"), hasPendingUserInput: true },
    { ...shell("working", "p2", "2026-01-01T01:00:00.000Z"), runtime: running },
    shell("idle", "p3", "2026-01-01T02:00:00.000Z"),
    {
      ...shell("snoozed", "p3", "2026-01-01T04:00:00.000Z"),
      runtime: running,
      snoozedUntil: "2026-01-03T00:00:00.000Z",
    },
    {
      ...shell("settled", "p3", "2026-01-01T05:00:00.000Z"),
      runtime: running,
      settledOverride: "settled" as const,
    },
  ];
  const build = (
    supported: boolean,
    statuses: readonly CollapsedThreadTabStatus[] = DEFAULT_COLLAPSED_TAB_STATUSES,
    openThreadKey: string | null = null,
  ) =>
    buildCollapsedThreadTabs({
      threads,
      projectGroups: [project("p1"), project("p2"), project("p3")],
      statuses: new Set(statuses),
      localLastVisitedAtById: {},
      now: NOW,
      openThreadKey,
      holds: createSidebarV2CompletedHoldTracker(),
      supports: () => ({ settlement: supported, snooze: supported }),
    });
  it("orders needs-input before working whatever their age, with only their projects", () => {
    const { tabs, projects } = build(true);
    expect(tabs.map((tab) => [tab.thread.id, tab.projectKey])).toEqual([
      ["asking", "p1"],
      ["working", "p2"],
    ]);
    expect(projects.map((group) => group.projectKey)).toEqual(["p1", "p2"]);
  });

  it("adds idle threads after working, and drops statuses left out", () => {
    expect(build(true, ["input", "working", "idle"]).tabs.map((tab) => tab.thread.id)).toEqual([
      "asking",
      "working",
      "idle",
    ]);
    expect(build(true, ["working"]).tabs.map((tab) => tab.thread.id)).toEqual(["working"]);
  });

  it("keeps the open thread as a tab when its status is left out, or it is parked", () => {
    const keyOf = (id: string) => scopedThreadKey(scopeThreadRef(environmentId, ThreadId.make(id)));
    expect(build(true, ["working"], keyOf("idle")).tabs.map((tab) => tab.thread.id)).toEqual([
      "working",
      "idle",
    ]);
    expect(build(true, ["working"], keyOf("settled")).tabs.map((tab) => tab.thread.id)).toContain(
      "settled",
    );
    expect(build(true, ["working"], keyOf("snoozed")).tabs.map((tab) => tab.thread.id)).toContain(
      "snoozed",
    );
  });

  it("keeps parked threads where the environment cannot park them, as the sidebar does", () => {
    expect(
      build(false)
        .tabs.map((tab) => tab.thread.id)
        .toSorted(),
    ).toEqual(["asking", "settled", "snoozed", "working"]);
  });
});

describe("collapsedDraftTabKey", () => {
  const draft = { environmentId, threadId: ThreadId.make("draft"), promotedTo: null };
  const key = scopedThreadKey(scopeThreadRef(environmentId, draft.threadId));
  it.each([
    // [label, draft, tabs, expected]
    ["gives the open draft a tab", draft, [], key],
    ["has no draft open", null, [], null],
    [
      "drops a draft that was sent",
      { ...draft, promotedTo: scopeThreadRef(environmentId, draft.threadId) },
      [],
      null,
    ],
    ["defers to the thread tab of a draft mid-promotion", draft, [{ threadKey: key }], null],
  ] as const)("%s", (_label, open, tabs, expected) => {
    expect(collapsedDraftTabKey({ draft: open, tabs })).toBe(expected);
  });
});

describe("collapsedPaneTabs", () => {
  const keyOf = (id: string) => scopedThreadKey(scopeThreadRef(environmentId, ThreadId.make(id)));
  const threads = [
    { ...shell("settled", "p1", NOW), settledOverride: "settled" as const },
    shell("asking", "p2", NOW),
  ];
  it.each([
    // [label, pane thread ids, panes with a draft, expected]
    [
      "gives the panes' threads in pane order, whatever their status",
      ["settled", "asking"],
      [false, false],
      ["thread:settled", "thread:asking"],
    ],
    [
      "keeps the unfocused pane's unsent draft, in its project, beside the focused pane's thread",
      ["asking", "new"],
      [false, true],
      ["thread:asking", "draft:1:p1"],
    ],
    // A sent draft's shell arrives after its send: the pair must not drop to one tab meanwhile.
    [
      "prefers the thread once its shell arrives, a draft until then",
      ["settled", "sent"],
      [true, true],
      ["thread:settled", "draft:1:p1"],
    ],
    ["drops a pane with neither", ["asking", "gone"], [false, false], ["thread:asking"]],
  ] as const)("%s", (_label, ids, paneHasDraft, expected) => {
    const panes = collapsedPaneTabs({
      threads,
      projectGroups: [project("p1"), project("p2")],
      paneThreadKeys: ids.map(keyOf),
      paneDrafts: paneHasDraft.map((has) => (has ? { environmentId, projectId: "p1" } : null)),
    });
    expect(
      panes.map((pane) =>
        pane.kind === "thread"
          ? `thread:${pane.tab.thread.id}`
          : `draft:${pane.pane}:${pane.projectKey}`,
      ),
    ).toEqual(expected);
  });
});

describe("collapsedFilterSwitchTarget", () => {
  const [a, b, c] = ["a", "b", "c"];
  it.each([
    // [label, after, next, open view's projects, expected]
    ["opens the first tab when the filter hides the open tab", [c], "p2", ["p1"], c],
    ["stays when the open tab is still shown", [b, a], "p1", ["p1"], null],
    ["stays on a draft or a thread without a shown tab", [c], "p2", null, null],
    ["has nowhere to go in an empty filter", [], "p2", ["p1"], null],
    ["leaves a split for a project neither pane is in", [c], "p3", ["p1", "p2"], c],
    ["stays in a split that holds a pane in the project", [c], "p2", ["p1", "p2"], null],
    ["stays under All", [a, c], "all", ["p1", "p2"], null],
  ] as const)("%s", (_label, after, nextProjectKey, openProjectKeys, expected) => {
    expect(collapsedFilterSwitchTarget({ after, nextProjectKey, openProjectKeys })).toBe(expected);
  });
});

describe("collapsedTabProjectForScope", () => {
  it.each([
    ["an unscoped sidebar leaves the strip's choice", [], null, null],
    ["one scoped project becomes the filter", ["p1"], null, "p1"],
    ["one scoped project holding the open thread", ["p1"], "p1", "p1"],
    ["one scoped project would hide the open thread's tab", ["p1"], "p2", "all"],
    ["several scoped projects show every project", ["p1", "p2"], "p1", "all"],
  ] as const)("%s", (_label, scope, openProjectId, expected) => {
    expect(
      collapsedTabProjectForScope({
        scope: scope.map(project),
        openThread:
          openProjectId === null
            ? null
            : { environmentId, projectId: ProjectId.make(openProjectId) },
      }),
    ).toBe(expected);
  });
});

describe("splitCollapsedTabsAroundPanes", () => {
  const tabs = ["a", "b", "c", "d"].map((threadKey) => ({ threadKey }));
  const keys = (list: readonly { readonly threadKey: string }[]) =>
    list.map((tab) => tab.threadKey);
  it.each([
    // [label, paneThreadKeys, before, after]
    ["takes the place of the thread split from", ["b", "x"], ["a"], ["c", "d"]],
    ["takes the first place either pane holds", ["d", "b"], ["a"], ["c"]],
    ["leads the row when neither pane has a tab", ["x", "y"], [], ["a", "b", "c", "d"]],
  ] as const)("%s", (_label, paneThreadKeys, before, after) => {
    const placed = splitCollapsedTabsAroundPanes(tabs, paneThreadKeys);
    expect([keys(placed.before), keys(placed.after)]).toEqual([before, after]);
  });
});

describe("fitCollapsedThreadTabs", () => {
  it.each([
    // [count, width, activeIndex, activeLength, visible, overflow]
    [3, 0, -1, 1, [0, 1, 2], []],
    // Three minimum tabs and their gaps fill the row exactly.
    [3, 3 * 132 + 2 * 6, -1, 1, [0, 1, 2], []],
    // A pixel short, the last tab goes behind More.
    [3, 3 * 132 + 2 * 6 - 1, -1, 1, [0, 1], [2]],
    // 500px holds three 138px steps beside More.
    [6, 500, -1, 1, [0, 1, 2], [3, 4, 5]],
    [6, 500, 4, 1, [0, 1, 4], [2, 3, 5]],
    // A split's group keeps both its tabs on screen.
    [6, 500, 3, 2, [0, 3, 4], [1, 2, 5]],
    [6, 500, 1, 2, [0, 1, 2], [3, 4, 5]],
    [6, 60, 4, 1, [], [0, 1, 2, 3, 4, 5]],
  ])(
    "%i tabs in %ipx with the open one at %i (%i long)",
    (count, width, activeIndex, activeLength, visible, overflow) => {
      expect(fitCollapsedThreadTabs({ count, width, activeIndex, activeLength })).toEqual({
        visible,
        overflow,
      });
    },
  );
});

describe("layoutCollapsedTabRow", () => {
  const entry = (threadKey: string) => ({ threadKey });
  const layout = (input: {
    readonly leading?: string;
    readonly tabs: readonly string[];
    readonly panes?: readonly string[];
    readonly openKey?: string;
    readonly width: number;
  }) => {
    const row = layoutCollapsedTabRow({
      leading: input.leading === undefined ? null : entry(input.leading),
      tabs: input.tabs.map(entry),
      panes: (input.panes ?? []).map(entry),
      openKey: input.openKey ?? null,
      width: input.width,
    });
    return {
      slots: row.slots.map((slot) =>
        slot.kind === "tab" ? slot.entry.threadKey : slot.entries.map((e) => e.threadKey),
      ),
      overflow: row.overflow.map((e) => e.threadKey),
    };
  };
  // 500px holds three 138px tab steps beside More; 210px holds one.
  it.each([
    [
      "leads with the draft, then the tabs",
      { leading: "draft", tabs: ["a", "b"], openKey: "draft", width: 0 },
      { slots: ["draft", "a", "b"], overflow: [] },
    ],
    [
      "keeps the open thread on screen",
      { tabs: ["a", "b", "c", "d", "e"], openKey: "e", width: 500 },
      { slots: ["a", "b", "e"], overflow: ["c", "d"] },
    ],
    [
      "puts the pair where the thread split from had its tab",
      { tabs: ["a", "b", "c"], panes: ["b", "x"], width: 0 },
      { slots: ["a", ["b", "x"], "c"], overflow: [] },
    ],
    [
      "keeps both of the pair on screen when two tabs fit",
      { tabs: ["a", "b", "c", "d", "e"], panes: ["d", "x"], width: 500 },
      { slots: ["a", ["d", "x"]], overflow: ["b", "c", "e"] },
    ],
    [
      "cuts the pair short only when one tab fits",
      { tabs: ["a", "b"], panes: ["b", "x"], width: 210 },
      { slots: [["b"]], overflow: ["a", "x"] },
    ],
    [
      "shows a lone pane as a plain tab",
      { tabs: ["a"], panes: ["x"], width: 0 },
      { slots: ["x", "a"], overflow: [] },
    ],
  ] as const)("%s", (_label, input, expected) => {
    expect(layout(input)).toEqual(expected);
  });
});
