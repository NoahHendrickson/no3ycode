/**
 * Unit tests for mobile status grouping, roster visibility, search/filter/sort,
 * long-press peek selectors, and bottom-nav route state.
 */
import { createSidebarV2CompletedHoldTracker } from "./forkStatusGrouping";
import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import {
  EnvironmentId,
  ProjectId,
  ProviderInstanceId,
  RunId,
  ScheduledTaskId,
  ThreadId,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import type { PendingNewTask } from "../src/state/use-pending-new-tasks";
import { makeThreadShellFixture } from "../src/test-fixtures";
import {
  buildNo3yStatusGroupedList,
  listNo3yAutomationRunThreads,
  resolveActiveNo3yNavItem,
  selectNo3yNavPeekItems,
  shouldShowNo3yBottomNav,
} from "./mobileStatusGrouping";

const ENV_ID = EnvironmentId.make("env-1");
const PROJECT_A = ProjectId.make("project-a");
const PROJECT_SCRATCH = ProjectId.make("project-scratch");
const NOW = "2026-11-22T12:00:00.000Z";

function makeProject(
  id: ProjectId,
  title: string,
  workspaceRoot = `/repos/${title.toLowerCase()}`,
): EnvironmentProject {
  return {
    environmentId: ENV_ID,
    id,
    title,
    workspaceRoot,
    defaultModelSelection: null,
    scripts: [],
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-20T00:00:00.000Z",
    pinnedAt: null,
    archivedAt: null,
    repositoryIdentity: null,
    faviconPath: null,
    projectIcon: null,
  };
}

function makeThread(
  id: string,
  overrides: Partial<EnvironmentThreadShell> = {},
): EnvironmentThreadShell {
  return makeThreadShellFixture({
    environmentId: ENV_ID,
    id: ThreadId.make(id),
    projectId: PROJECT_A,
    title: `Thread ${id}`,
    createdAt: "2026-11-22T10:00:00.000Z",
    updatedAt: "2026-11-22T10:00:00.000Z",
    lastVisitedAt: "2026-11-22T10:05:00.000Z",
    latestUserMessageAt: "2026-11-22T10:00:00.000Z",
    latestUserAuthoredMessageAt: "2026-11-22T10:00:00.000Z",
    ...overrides,
  });
}

function withSourcePatch(
  thread: EnvironmentThreadShell,
  patch: Record<string, unknown>,
): EnvironmentThreadShell {
  return {
    ...thread,
    source: { ...thread.source, ...patch } as EnvironmentThreadShell["source"],
  };
}

function makeDraft(key: string, title: string): PendingNewTask {
  return {
    kind: "draft",
    key,
    draftKey: `new-task:${key}`,
    draftId: key,
    environmentId: ENV_ID,
    projectId: PROJECT_A,
    title,
    createdAt: "2026-11-22T11:50:00.000Z",
    branch: null,
    worktreePath: null,
  } as unknown as PendingNewTask;
}

describe("buildNo3yStatusGroupedList", () => {
  it("orders Drafts above Pinned, then Needs input, Completed, Working, Idle, Snoozed, Settled", () => {
    const pinned = makeThread("pinned", { pinnedAt: "2026-11-22T11:00:00.000Z" });
    const needsInput = makeThread("input", { hasPendingApprovals: true });
    const completed = makeThread("done", {
      lastVisitedAt: "2026-11-22T10:00:00.000Z",
      latestRun: {
        runId: RunId.make("r1"),
        status: "completed",
        requestedAt: "2026-11-22T10:00:00.000Z",
        startedAt: "2026-11-22T10:01:00.000Z",
        completedAt: "2026-11-22T10:10:00.000Z",
        assistantMessageId: null,
      },
    });
    const working = makeThread("working", {
      runtime: {
        status: "running",
        activeRunId: RunId.make("r2"),
        providerInstanceId: ProviderInstanceId.make("codex"),
        providerName: null,
        lastError: null,
        updatedAt: NOW,
      },
    });
    const idle = makeThread("idle");
    const snoozed = makeThread("snoozed", { snoozedUntil: "2026-11-22T18:00:00.000Z" });
    const settled = makeThread("settled", {
      settledOverride: "settled",
      settledAt: "2026-11-22T09:00:00.000Z",
    });

    const result = buildNo3yStatusGroupedList({
      threads: [settled, snoozed, idle, working, completed, needsInput, pinned],
      pendingTasks: [makeDraft("d1", "Unsent prompt")],
      environmentId: null,
      projectRefs: null,
      searchQuery: "",
      statusFilter: "all",
      sortOrder: "status",
      collapsedSections: new Set(),
      snoozedShelfExpanded: true,
      settledShelfExpanded: true,
      settledLimit: 10,
      now: NOW,
      openThreadKey: null,
      holds: createSidebarV2CompletedHoldTracker(),
    });

    const sections = result.items
      .filter((item) => item.type === "no3y-section-header")
      .map((item) => item.section);

    expect(sections).toEqual([
      "drafts",
      "pinned",
      "input",
      "done",
      "working",
      "idle",
      "snoozed",
      "settled",
    ]);
  });

  it("enforces fork roster visibility: hides automation runs, live bot work, and subagents unless pinned", () => {
    const regular = makeThread("regular");
    const automationHidden = withSourcePatch(makeThread("auto-run"), {
      scheduledTaskId: ScheduledTaskId.make("task-1"),
    });
    const automationPinned = withSourcePatch(
      makeThread("auto-pinned", { pinnedAt: "2026-11-22T11:30:00.000Z" }),
      { scheduledTaskId: ScheduledTaskId.make("task-1") },
    );
    const liveBot = withSourcePatch(makeThread("bot-1"), { tags: ["bot"] });
    const botWorkHidden = withSourcePatch(makeThread("bot-work-1"), {
      tags: ["bot-work:bot-1"],
    });
    const botWorkPinned = withSourcePatch(
      makeThread("bot-work-pinned", { pinnedAt: "2026-11-22T11:31:00.000Z" }),
      { tags: ["bot-work:bot-1"] },
    );
    const archivedBot = withSourcePatch(
      makeThread("bot-archived", { archivedAt: "2026-11-22T08:00:00.000Z" }),
      { tags: ["bot"] },
    );
    const orphanedBotWork = withSourcePatch(makeThread("bot-work-orphan"), {
      tags: ["bot-work:bot-archived"],
    });
    const subagent = makeThread("sub-1", {
      lineage: {
        parentThreadId: ThreadId.make("regular"),
        relationshipToParent: "subagent",
        rootThreadId: ThreadId.make("regular"),
      },
    });
    const chatThread = withSourcePatch(makeThread("chat-1"), { tags: ["chat"] });

    const result = buildNo3yStatusGroupedList({
      threads: [
        regular,
        automationHidden,
        automationPinned,
        liveBot,
        botWorkHidden,
        botWorkPinned,
        archivedBot,
        orphanedBotWork,
        subagent,
        chatThread,
      ],
      pendingTasks: [],
      environmentId: null,
      projectRefs: null,
      searchQuery: "",
      statusFilter: "all",
      sortOrder: "status",
      collapsedSections: new Set(),
      snoozedShelfExpanded: true,
      settledShelfExpanded: true,
      settledLimit: 10,
      now: NOW,
      openThreadKey: null,
      holds: createSidebarV2CompletedHoldTracker(),
      excludeChatThreads: true,
    });

    const listedIds = result.items
      .filter((item) => item.type === "no3y-thread")
      .map((item) => String(item.item.thread.id));

    expect(listedIds).toContain("regular");
    expect(listedIds).toContain("auto-pinned");
    expect(listedIds).toContain("bot-work-pinned");
    expect(listedIds).toContain("bot-work-orphan");
    expect(listedIds).not.toContain("auto-run");
    expect(listedIds).not.toContain("bot-1");
    expect(listedIds).not.toContain("bot-work-1");
    expect(listedIds).not.toContain("sub-1");
    expect(listedIds).not.toContain("chat-1");

    const automationRuns = listNo3yAutomationRunThreads({
      threads: [regular, automationHidden, automationPinned],
    });
    expect(automationRuns.map((thread) => String(thread.id))).toEqual(["auto-run", "auto-pinned"]);
  });

  it("supports status filtering, timestamp sorting, and collapsed sections", () => {
    const olderIdle = makeThread("older", {
      createdAt: "2026-11-20T00:00:00.000Z",
      updatedAt: "2026-11-20T00:00:00.000Z",
    });
    const newerIdle = makeThread("newer", {
      createdAt: "2026-11-22T09:00:00.000Z",
      updatedAt: "2026-11-22T09:00:00.000Z",
    });
    const working = makeThread("working", {
      runtime: {
        status: "running",
        activeRunId: RunId.make("r-w"),
        providerInstanceId: ProviderInstanceId.make("codex"),
        providerName: null,
        lastError: null,
        updatedAt: NOW,
      },
    });

    const sorted = buildNo3yStatusGroupedList({
      threads: [olderIdle, newerIdle, working],
      pendingTasks: [],
      environmentId: null,
      projectRefs: null,
      searchQuery: "",
      statusFilter: "idle",
      sortOrder: "created_at",
      collapsedSections: new Set(),
      snoozedShelfExpanded: true,
      settledShelfExpanded: true,
      settledLimit: 10,
      now: NOW,
      openThreadKey: null,
      holds: createSidebarV2CompletedHoldTracker(),
    });
    const threadIds = sorted.items
      .filter((item) => item.type === "no3y-thread")
      .map((item) => String(item.item.thread.id));
    expect(threadIds).toEqual(["newer", "older"]);

    const collapsed = buildNo3yStatusGroupedList({
      threads: [olderIdle, newerIdle],
      pendingTasks: [],
      environmentId: null,
      projectRefs: null,
      searchQuery: "",
      statusFilter: "all",
      sortOrder: "status",
      collapsedSections: new Set(["idle"]),
      snoozedShelfExpanded: true,
      settledShelfExpanded: true,
      settledLimit: 10,
      now: NOW,
      openThreadKey: null,
      holds: createSidebarV2CompletedHoldTracker(),
    });
    expect(collapsed.items).toHaveLength(1);
    expect(collapsed.items[0]).toMatchObject({
      type: "no3y-section-header",
      section: "idle",
      count: 2,
      collapsed: true,
    });
  });

  it("holds a thread in Completed for 5 minutes after it transitions from Working to Idle", () => {
    const holds = createSidebarV2CompletedHoldTracker(5 * 60_000);
    const t0 = Date.parse(NOW);
    const running = makeThread("t1", {
      runtime: {
        status: "running",
        activeRunId: RunId.make("r1"),
        providerInstanceId: ProviderInstanceId.make("codex"),
        providerName: null,
        lastError: null,
        updatedAt: NOW,
      },
    });
    const idleNow = makeThread("t1", { runtime: null });

    buildNo3yStatusGroupedList({
      threads: [running],
      pendingTasks: [],
      environmentId: null,
      projectRefs: null,
      searchQuery: "",
      statusFilter: "all",
      sortOrder: "status",
      collapsedSections: new Set(),
      snoozedShelfExpanded: false,
      settledShelfExpanded: false,
      settledLimit: 10,
      now: NOW,
      nowMs: t0,
      openThreadKey: null,
      holds,
    });

    const justFinished = buildNo3yStatusGroupedList({
      threads: [idleNow],
      pendingTasks: [],
      environmentId: null,
      projectRefs: null,
      searchQuery: "",
      statusFilter: "all",
      sortOrder: "status",
      collapsedSections: new Set(),
      snoozedShelfExpanded: false,
      settledShelfExpanded: false,
      settledLimit: 10,
      now: NOW,
      nowMs: t0 + 60_000,
      openThreadKey: null,
      holds,
    });
    expect(justFinished.items[0]).toMatchObject({ type: "no3y-section-header", section: "done" });

    const afterHold = buildNo3yStatusGroupedList({
      threads: [idleNow],
      pendingTasks: [],
      environmentId: null,
      projectRefs: null,
      searchQuery: "",
      statusFilter: "all",
      sortOrder: "status",
      collapsedSections: new Set(),
      snoozedShelfExpanded: false,
      settledShelfExpanded: false,
      settledLimit: 10,
      now: NOW,
      nowMs: t0 + 7 * 60_000,
      openThreadKey: null,
      holds,
    });
    expect(afterHold.items[0]).toMatchObject({ type: "no3y-section-header", section: "idle" });
  });
});

describe("selectNo3yNavPeekItems", () => {
  it("lists working then needs-input roster threads for Threads, automation runs for Automations, recent projects for New agent, and chats for Chat", () => {
    const projectA = makeProject(PROJECT_A, "Alpha");
    const scratch = makeProject(PROJECT_SCRATCH, "No project");
    const scratchKeys = new Set([`${ENV_ID}:${PROJECT_SCRATCH}`]);

    const workingThread = makeThread("w1", {
      updatedAt: "2026-11-22T11:55:00.000Z",
      runtime: {
        status: "running",
        activeRunId: RunId.make("rw"),
        providerInstanceId: ProviderInstanceId.make("codex"),
        providerName: null,
        lastError: null,
        updatedAt: NOW,
      },
    });
    const inputThread = makeThread("i1", {
      updatedAt: "2026-11-22T11:59:00.000Z",
      hasPendingApprovals: true,
    });
    const workingAutomation = withSourcePatch(
      makeThread("auto-w", {
        updatedAt: "2026-11-22T11:58:00.000Z",
        runtime: {
          status: "running",
          activeRunId: RunId.make("ra"),
          providerInstanceId: ProviderInstanceId.make("codex"),
          providerName: null,
          lastError: null,
          updatedAt: NOW,
        },
      }),
      { scheduledTaskId: ScheduledTaskId.make("sched-1") },
    );
    const chatThread = makeThread("chat-1", {
      projectId: PROJECT_SCRATCH,
      updatedAt: "2026-11-22T11:50:00.000Z",
    });

    const threads = [inputThread, workingThread, workingAutomation, chatThread];
    const projects = [projectA, scratch];

    const threadsPeek = selectNo3yNavPeekItems({
      item: "threads",
      threads,
      projects,
      scratchProjectKeys: scratchKeys,
      now: NOW,
    });
    expect(
      threadsPeek.map((entry) => (entry.kind === "thread" ? String(entry.thread.id) : "")),
    ).toEqual(["w1", "i1"]);

    const autoPeek = selectNo3yNavPeekItems({
      item: "automations",
      threads,
      projects,
      scratchProjectKeys: scratchKeys,
      now: NOW,
    });
    expect(
      autoPeek.map((entry) => (entry.kind === "thread" ? String(entry.thread.id) : "")),
    ).toEqual(["auto-w"]);

    const newAgentPeek = selectNo3yNavPeekItems({
      item: "newAgent",
      threads,
      projects,
      scratchProjectKeys: scratchKeys,
      now: NOW,
    });
    expect(
      newAgentPeek.map((entry) => (entry.kind === "project" ? String(entry.project.id) : "")),
    ).toEqual([String(PROJECT_A)]);

    const chatPeek = selectNo3yNavPeekItems({
      item: "chat",
      threads,
      projects,
      scratchProjectKeys: scratchKeys,
      now: NOW,
    });
    expect(
      chatPeek.map((entry) => (entry.kind === "thread" ? String(entry.thread.id) : "")),
    ).toEqual(["chat-1"]);
  });
});

describe("bottom nav route resolution", () => {
  it("maps stack routes to active nav items and hides only on overlays/immersive routes", () => {
    expect(resolveActiveNo3yNavItem([{ name: "Home" }])).toBe("threads");
    expect(
      resolveActiveNo3yNavItem([{ name: "Home" }, { name: "Thread", params: { threadId: "t1" } }]),
    ).toBe("threads");
    expect(
      resolveActiveNo3yNavItem([
        { name: "Home" },
        { name: "Thread", params: { draft: { requestId: "1" } } },
      ]),
    ).toBe("newAgent");
    expect(resolveActiveNo3yNavItem([{ name: "Home" }, { name: "SettingsScheduledTasks" }])).toBe(
      "automations",
    );
    expect(resolveActiveNo3yNavItem([{ name: "Home" }, { name: "No3yChat" }])).toBe("chat");

    expect(shouldShowNo3yBottomNav({ topRouteName: "Home", isOverlayRoute: false })).toBe(true);
    expect(shouldShowNo3yBottomNav({ topRouteName: "Thread", isOverlayRoute: false })).toBe(true);
    expect(
      shouldShowNo3yBottomNav({ topRouteName: "ThreadDevicePreview", isOverlayRoute: false }),
    ).toBe(false);
    expect(shouldShowNo3yBottomNav({ topRouteName: "GitOverview", isOverlayRoute: true })).toBe(
      false,
    );
  });
});
