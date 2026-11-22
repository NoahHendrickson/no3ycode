// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard and web/mobile parity check — see `.fork/customizations.yaml#no3y-mobile-redesign`. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { effectiveSnoozed, threadWokeAt } from "@t3tools/client-runtime/state/thread-settled";
import { threadKey } from "@t3tools/client-runtime/state/entities";
import {
  type EnvironmentId,
  ProviderInstanceId,
  RunId,
  ScheduledTaskId,
  ThreadId,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  filterSidebarV2VisibleThreads,
  hasUnseenCompletion,
  resolveSidebarThreadSection,
  resolveSidebarThreadStatus,
  type SidebarThreadStatus,
} from "../components/Sidebar.logic";
import {
  isBotWorkOffSidebar as webIsBotWorkOffSidebar,
  listedBotKeys as webListedBotKeys,
} from "../custom/bots/botWorkRoster";
import { isScheduledRunOffSidebar as webIsScheduledRunOffSidebar } from "../custom/scheduledRunsOffSidebar";
import {
  resolveSidebarV2CardStatusKind as webResolveCardStatusKind,
  type SidebarV2CardStatusKind,
} from "../custom/sidebarV2CardStatus";
import { threadCardTitleRecedes as webThreadCardTitleRecedes } from "../custom/sidebarV2RowPolicy";
import {
  buildSidebarV2StatusSections as webBuildStatusSections,
  createSidebarV2CompletedHoldTracker as webCreateCompletedHoldTracker,
  groupSidebarV2StatusSections as webGroupStatusSections,
  SIDEBAR_V2_STATUS_SECTION_LABELS as WEB_STATUS_SECTION_LABELS,
  sidebarV2StatusBucketForKind as webStatusBucketForKind,
  splitSidebarV2DraftsSection as webSplitDraftsSection,
  type SidebarV2CompletedHoldTracker,
  type SidebarV2StatusBucket,
  type SidebarV2StatusHeaderKey,
  type SidebarV2StatusSection,
} from "../custom/sidebarV2StatusGrouping";
import { makeThreadFixture } from "../test-fixtures";
import type { Thread } from "../types";

interface MobileRosterModule {
  readonly filterForkRosterVisibleThreads: <T extends Thread>(
    threads: readonly T[],
    options?: {
      readonly delegatedUnderParent?: ReadonlySet<string>;
      readonly excludeBots?: boolean;
    },
  ) => T[];
  readonly isScheduledRunOffSidebar: typeof webIsScheduledRunOffSidebar;
  readonly listedBotKeys: typeof webListedBotKeys;
  readonly isBotWorkOffSidebar: typeof webIsBotWorkOffSidebar;
}

interface MobileStatusGroupingModule {
  readonly SIDEBAR_V2_STATUS_BUCKET_ORDER: readonly SidebarV2StatusBucket[];
  readonly SIDEBAR_V2_STATUS_SECTION_LABELS: Record<SidebarV2StatusHeaderKey, string>;
  readonly resolveSidebarV2CardStatusKind: (input: {
    readonly status: SidebarThreadStatus;
    readonly isUnread: boolean;
    readonly isWoke: boolean;
    readonly hasPendingBackgroundTasks: boolean;
  }) => SidebarV2CardStatusKind | null;
  readonly sidebarV2StatusBucketForKind: typeof webStatusBucketForKind;
  readonly createSidebarV2CompletedHoldTracker: (holdMs?: number) => SidebarV2CompletedHoldTracker;
  readonly groupSidebarV2StatusSections: <TThread extends Thread>(input: {
    readonly threads: readonly TThread[];
    readonly bucketOf: (thread: TThread) => SidebarV2StatusBucket;
    readonly returnedAt?: ((thread: TThread) => number | undefined) | undefined;
  }) => SidebarV2StatusSection<TThread>[];
  readonly splitSidebarV2DraftsSection: typeof webSplitDraftsSection;
  readonly threadCardTitleRecedes: typeof webThreadCardTitleRecedes;
  readonly partitionForkStatusShelves: <TThread extends Thread>(input: {
    readonly threads: readonly TThread[];
    readonly now: string;
    readonly settlementEnvironmentIds?: ReadonlySet<EnvironmentId> | undefined;
    readonly snoozeEnvironmentIds?: ReadonlySet<EnvironmentId> | undefined;
    readonly queuedThreadKeys?: ReadonlySet<string> | undefined;
  }) => {
    readonly pinned: TThread[];
    readonly active: TThread[];
    readonly snoozed: TThread[];
    readonly settled: TThread[];
  };
}

// Dynamic path import keeps apps/web/tsconfig.json untouched while loading the real mobile TS files.
async function loadMobileModules(): Promise<{
  readonly roster: MobileRosterModule;
  readonly grouping: MobileStatusGroupingModule;
}> {
  const rosterPath = NodeURL.fileURLToPath(
    new URL("../../../mobile/fork/forkRosterVisibility.ts", import.meta.url),
  );
  const groupingPath = NodeURL.fileURLToPath(
    new URL("../../../mobile/fork/forkStatusGrouping.ts", import.meta.url),
  );
  const [roster, grouping] = (await Promise.all([
    import(/* @vite-ignore */ rosterPath),
    import(/* @vite-ignore */ groupingPath),
  ])) as [MobileRosterModule, MobileStatusGroupingModule];
  return { roster, grouping };
}

function readRepoFile(relativePath: string): string {
  return NodeFS.readFileSync(
    NodeURL.fileURLToPath(new URL(`../../../../${relativePath}`, import.meta.url)),
    "utf8",
  );
}

const NOW = "2026-11-22T12:00:00.000Z";

function threadFixture(id: string, overrides: Partial<Thread> = {}): Thread {
  return makeThreadFixture({
    id: ThreadId.make(id),
    createdAt: "2026-11-22T10:00:00.000Z",
    updatedAt: "2026-11-22T10:00:00.000Z",
    lastVisitedAt: "2026-11-22T10:05:00.000Z",
    ...overrides,
  });
}

function withSource(thread: Thread, patch: Partial<Thread["source"]>): Thread {
  return { ...thread, source: { ...thread.source, ...patch } };
}

function makeRuntime(
  status: NonNullable<Thread["runtime"]>["status"],
): NonNullable<Thread["runtime"]> {
  return {
    status,
    activeRunId: status === "running" ? RunId.make("run:active") : null,
    providerInstanceId: ProviderInstanceId.make("codex"),
    providerName: null,
    lastError: status === "failed" ? "boom" : null,
    updatedAt: NOW,
  };
}

describe("fork guard: no3y-mobile-redesign", () => {
  it("matches web roster visibility identically on automation runs, bot work, bots, subagents, and archived threads", async () => {
    const { roster } = await loadMobileModules();

    const regular = threadFixture("regular");
    const automationUnpinned = withSource(threadFixture("auto-unpinned"), {
      scheduledTaskId: ScheduledTaskId.make("sched-1"),
    });
    const automationPinned = withSource(threadFixture("auto-pinned", { pinnedAt: NOW }), {
      scheduledTaskId: ScheduledTaskId.make("sched-1"),
    });
    const liveBot = withSource(threadFixture("bot-live"), { tags: ["bot"] });
    const botWorkUnpinned = withSource(threadFixture("bot-work-unpinned"), {
      tags: ["bot-work:bot-live"],
    });
    const botWorkPinned = withSource(threadFixture("bot-work-pinned", { pinnedAt: NOW }), {
      tags: ["bot-work:bot-live"],
    });
    const archivedBot = withSource(threadFixture("bot-archived", { archivedAt: NOW }), {
      tags: ["bot"],
    });
    const orphanedBotWork = withSource(threadFixture("bot-work-orphan"), {
      tags: ["bot-work:bot-archived"],
    });
    const subagent = threadFixture("subagent", {
      lineage: {
        parentThreadId: ThreadId.make("regular"),
        relationshipToParent: "subagent",
        rootThreadId: ThreadId.make("regular"),
      },
    });
    const delegatedChild = threadFixture("delegated");
    const archived = threadFixture("archived", { archivedAt: NOW });

    const fixtures = [
      regular,
      automationUnpinned,
      automationPinned,
      liveBot,
      botWorkUnpinned,
      botWorkPinned,
      archivedBot,
      orphanedBotWork,
      subagent,
      delegatedChild,
      archived,
    ];
    const delegatedUnderParent = new Set([
      threadKey({ environmentId: delegatedChild.environmentId, threadId: delegatedChild.id }),
    ]);

    const webVisible = filterSidebarV2VisibleThreads(fixtures, null, delegatedUnderParent).map(
      (thread) => thread.id,
    );
    const mobileVisible = roster
      .filterForkRosterVisibleThreads(fixtures, { delegatedUnderParent })
      .map((thread) => thread.id);

    expect(mobileVisible).toEqual(webVisible);
    expect(mobileVisible).toEqual(["regular", "auto-pinned", "bot-work-pinned", "bot-work-orphan"]);

    const webBots = webListedBotKeys(fixtures);
    const mobileBots = roster.listedBotKeys(fixtures);
    expect([...mobileBots]).toEqual([...webBots]);

    for (const thread of fixtures) {
      expect(roster.isScheduledRunOffSidebar(thread)).toBe(webIsScheduledRunOffSidebar(thread));
      expect(roster.isBotWorkOffSidebar(thread, mobileBots)).toBe(
        webIsBotWorkOffSidebar(thread, webBots),
      );
    }
  });

  it("matches web status kinds, buckets, drafts split, Completed hold, and section grouping identically", async () => {
    const { grouping } = await loadMobileModules();

    expect(grouping.SIDEBAR_V2_STATUS_SECTION_LABELS).toEqual(WEB_STATUS_SECTION_LABELS);

    const baseStatuses: readonly SidebarThreadStatus[] = [
      "approval",
      "input",
      "request",
      "preparing",
      "working",
      "waiting",
      "failed",
      "limited",
      "ready",
    ];
    for (const status of baseStatuses) {
      for (const isUnread of [false, true]) {
        for (const isWoke of [false, true]) {
          for (const hasPendingBackgroundTasks of [false, true]) {
            const input = { status, isUnread, isWoke, hasPendingBackgroundTasks };
            const webKind = webResolveCardStatusKind(input);
            const mobileKind = grouping.resolveSidebarV2CardStatusKind(input);
            expect(mobileKind).toBe(webKind);
            expect(grouping.sidebarV2StatusBucketForKind(mobileKind)).toBe(
              webStatusBucketForKind(webKind),
            );
          }
        }
      }
    }

    const draft = threadFixture("draft", { createdAt: "2026-11-22T11:55:00.000Z" });
    const needsApproval = threadFixture("approval", {
      hasPendingApprovals: true,
      createdAt: "2026-11-22T11:40:00.000Z",
    });
    const failed = threadFixture("failed", {
      runtime: makeRuntime("failed"),
      createdAt: "2026-11-22T11:30:00.000Z",
    });
    const unreadDone = threadFixture("done", {
      lastVisitedAt: "2026-11-22T10:00:00.000Z",
      latestRun: {
        runId: RunId.make("r-done"),
        status: "completed",
        requestedAt: "2026-11-22T10:10:00.000Z",
        startedAt: "2026-11-22T10:11:00.000Z",
        completedAt: "2026-11-22T10:20:00.000Z",
        assistantMessageId: null,
      },
    });
    const woke = threadFixture("woke", {
      snoozedUntil: "2026-11-22T11:00:00.000Z",
      lastVisitedAt: "2026-11-22T10:30:00.000Z",
    });
    const working = threadFixture("working", {
      runtime: makeRuntime("running"),
      latestUserAuthoredMessageAt: "2026-11-22T11:50:00.000Z",
    });
    const idle = threadFixture("idle", { createdAt: "2026-11-22T09:00:00.000Z" });

    const activeThreads = [idle, working, woke, unreadDone, failed, needsApproval, draft];
    const draftKey = `${draft.environmentId}:${draft.id}`;
    const isDraft = (key: string) => key === draftKey;

    const webSections = webBuildStatusSections({
      threads: activeThreads,
      localLastVisitedAtById: {},
      now: NOW,
      openThreadKey: null,
      holds: webCreateCompletedHoldTracker(),
      isDraft,
    });

    const mobileBuckets = new Map<string, SidebarV2StatusBucket>();
    for (const thread of activeThreads) {
      const key = `${thread.environmentId}:${thread.id}`;
      const baseStatus = resolveSidebarThreadStatus(thread);
      const kind = grouping.resolveSidebarV2CardStatusKind({
        status: baseStatus,
        isUnread: baseStatus === "ready" && hasUnseenCompletion(thread),
        isWoke: threadWokeAt(thread, { now: NOW }) !== null,
        hasPendingBackgroundTasks: thread.pendingBackgroundTasks.length > 0,
      });
      mobileBuckets.set(key, grouping.sidebarV2StatusBucketForKind(kind));
    }
    const mobileEffective = grouping.createSidebarV2CompletedHoldTracker().apply({
      buckets: mobileBuckets,
      openThreadKey: null,
      nowMs: Date.parse(NOW),
    });
    const mobileSections = grouping.groupSidebarV2StatusSections({
      threads: activeThreads,
      bucketOf: (thread) => {
        const key = `${thread.environmentId}:${thread.id}`;
        return isDraft(key) ? "drafts" : (mobileEffective.get(key) ?? "idle");
      },
    });

    const summarize = (sections: readonly { status: string; threads: readonly Thread[] }[]) =>
      sections.map((section) => ({
        status: section.status,
        ids: section.threads.map((thread) => thread.id),
      }));

    expect(summarize(mobileSections)).toEqual(summarize(webSections));
    expect(summarize(mobileSections).map((section) => section.status)).toEqual([
      "drafts",
      "input",
      "done",
      "working",
      "idle",
    ]);

    const webSplit = webSplitDraftsSection(webSections);
    const mobileSplit = grouping.splitSidebarV2DraftsSection(mobileSections);
    expect(mobileSplit.draftsSection?.threads.map((thread) => thread.id)).toEqual(
      webSplit.draftsSection?.threads.map((thread) => thread.id),
    );
    expect(summarize(mobileSplit.listSections)).toEqual(summarize(webSplit.listSections));

    // Verify 5-minute Completed hold parity across ticks.
    const webHold = webCreateCompletedHoldTracker();
    const mobileHold = grouping.createSidebarV2CompletedHoldTracker();
    const t0 = Date.parse(NOW);
    const ticks: Array<{
      buckets: ReadonlyMap<string, SidebarV2StatusBucket>;
      openThreadKey: string | null;
      nowMs: number;
    }> = [
      { buckets: new Map([["t1", "working"]]), openThreadKey: null, nowMs: t0 },
      { buckets: new Map([["t1", "idle"]]), openThreadKey: "t1", nowMs: t0 + 60_000 },
      { buckets: new Map([["t1", "idle"]]), openThreadKey: null, nowMs: t0 + 4 * 60_000 },
      { buckets: new Map([["t1", "idle"]]), openThreadKey: null, nowMs: t0 + 10 * 60_000 },
    ];
    for (const tick of ticks) {
      expect([...mobileHold.apply(tick)]).toEqual([...webHold.apply(tick)]);
    }

    // Verify title recession policy parity.
    for (const statusSection of [undefined, ...grouping.SIDEBAR_V2_STATUS_BUCKET_ORDER] as const) {
      for (const isDone of [false, true]) {
        for (const isIdle of [false, true]) {
          for (const isActive of [false, true]) {
            for (const isSelected of [false, true]) {
              const args = { isDone, isIdle, isActive, isSelected, statusSection };
              expect(grouping.threadCardTitleRecedes(args)).toBe(webThreadCardTitleRecedes(args));
            }
          }
        }
      }
    }

    const directWeb = webGroupStatusSections({
      threads: activeThreads,
      bucketOf: (thread) =>
        isDraft(`${thread.environmentId}:${thread.id}`)
          ? "drafts"
          : (mobileEffective.get(`${thread.environmentId}:${thread.id}`) ?? "idle"),
    });
    expect(summarize(mobileSections)).toEqual(summarize(directWeb));
  });

  it("matches web pinned, snoozed, settled, and active shelf precedence identically", async () => {
    const { grouping } = await loadMobileModules();

    const active = threadFixture("active");
    const pinned = threadFixture("pinned", { pinnedAt: NOW });
    const snoozed = threadFixture("snoozed", { snoozedUntil: "2026-11-22T18:00:00.000Z" });
    const pinnedAndSnoozed = threadFixture("pinned-snoozed", {
      pinnedAt: NOW,
      snoozedUntil: "2026-11-22T18:00:00.000Z",
    });
    const settled = threadFixture("settled", {
      settledOverride: "settled",
      settledAt: "2026-11-22T09:00:00.000Z",
    });
    const pinnedAndSettled = threadFixture("pinned-settled", {
      pinnedAt: NOW,
      settledOverride: "settled",
      settledAt: "2026-11-22T09:00:00.000Z",
    });
    const snoozedAndSettled = threadFixture("snoozed-settled", {
      snoozedUntil: "2026-11-22T18:00:00.000Z",
      settledOverride: "settled",
      settledAt: "2026-11-22T09:00:00.000Z",
    });

    const fixtures = [
      active,
      pinned,
      snoozed,
      pinnedAndSnoozed,
      settled,
      pinnedAndSettled,
      snoozedAndSettled,
    ];

    const mobilePartition = grouping.partitionForkStatusShelves({ threads: fixtures, now: NOW });
    const webPartition = {
      pinned: [] as ThreadId[],
      active: [] as ThreadId[],
      snoozed: [] as ThreadId[],
      settled: [] as ThreadId[],
    };
    for (const thread of fixtures) {
      const section = resolveSidebarThreadSection({
        snoozed: effectiveSnoozed(thread, { now: NOW }),
        settled: thread.settledOverride === "settled",
        pinned: thread.pinnedAt != null,
      });
      if (section === "snoozed") webPartition.snoozed.push(thread.id);
      else if (section === "settled") webPartition.settled.push(thread.id);
      else if (section === "pinned") webPartition.pinned.push(thread.id);
      else webPartition.active.push(thread.id);
    }

    expect({
      pinned: mobilePartition.pinned.map((thread) => thread.id),
      active: mobilePartition.active.map((thread) => thread.id),
      snoozed: mobilePartition.snoozed.map((thread) => thread.id),
      settled: mobilePartition.settled.map((thread) => thread.id),
    }).toEqual(webPartition);
  });

  it("mounts the dock host, Chat route, Flat Glass threads, and Automations runs in mobile seams", () => {
    const stack = readRepoFile("apps/mobile/src/Stack.tsx");
    const nativeTabs = readRepoFile(
      "apps/mobile/src/features/layout/workspace/WorkspaceNativeTabs.ios.tsx",
    );
    const toolbar = readRepoFile("apps/mobile/src/features/layout/workspace/WorkspaceToolbar.tsx");
    const homeScreen = readRepoFile("apps/mobile/src/features/home/HomeScreen.tsx");
    const mobileGrouping = readRepoFile("apps/mobile/fork/mobileStatusGrouping.ts");
    const filters = readRepoFile("apps/mobile/src/features/home/ThreadListFilters.tsx");
    const dock = readRepoFile("apps/mobile/fork/No3yBottomNav.tsx");
    const mobilePackage = JSON.parse(readRepoFile("apps/mobile/package.json")) as {
      readonly dependencies: Record<string, string>;
    };
    const webPackage = JSON.parse(readRepoFile("apps/web/package.json")) as {
      readonly dependencies: Record<string, string>;
    };
    const threadDetail = readRepoFile("apps/mobile/src/features/threads/ThreadDetailScreen.tsx");

    expect(stack).toContain('import { No3yBottomNavHost } from "../fork/No3yBottomNav";');
    expect(stack).toContain('import { No3yChatRouteScreen } from "../fork/No3yChatRouteScreen";');
    expect(stack).toContain("<No3yBottomNavHost state={props.state} />");
    expect(stack).toContain("No3yChat: createNativeStackScreen({");
    expect(nativeTabs).toContain("!compactTabs &&");
    expect(toolbar).toContain(
      '!(no3yBottomNav && !workspace.settingsOpen && selectedTab === "threads")',
    );
    expect(dock).toContain('{ id: "settings", label: "Settings", icon: Settings01Icon }');
    // The dock draws the same Hugeicons release the Mac fork does.
    expect(mobilePackage.dependencies["@hugeicons/core-free-icons"]).toBe(
      webPackage.dependencies["@hugeicons/core-free-icons"],
    );
    expect(homeScreen).toContain("<No3yThreadsListView");
    expect(mobileGrouping).toContain('from "./forkRosterVisibility"');
    expect(mobileGrouping).toContain('from "./forkStatusGrouping"');
    expect(mobileGrouping).toContain("partitionForkStatusShelves(");
    // Threads search, filter and sort live in fork/No3yThreadsFilterBar.tsx; upstream stays as is.
    expect(filters).not.toContain("fork:begin");
    expect(threadDetail).toContain("no3yBottomNav ? NO3Y_BOTTOM_NAV_CLEARANCE : 0");
  });
});
