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
import {
  BOT_MASCOT_MOODS as WEB_BOT_MASCOT_MOODS,
  BOT_MASCOT_SHAPES as WEB_BOT_MASCOT_SHAPES,
  botMascotSprite as webBotMascotSprite,
} from "../custom/bots/botMascotArt";
import { botMascotShape as webBotMascotShape } from "../custom/bots/botMascotTags";
import {
  botStatusLine as webBotStatusLine,
  listSidebarBots as webListSidebarBots,
} from "../custom/bots/botThreads";
import { botWorkStatusText as webBotWorkStatusText } from "../custom/bots/botWork";
import { isChatThread as webIsChatThread, shellThreadKey } from "../custom/chatMode";
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

  it("lists bots, picks their mascots and draws their sprites exactly as web does", async () => {
    const botsPath = NodeURL.fileURLToPath(
      new URL("../../../mobile/fork/forkBots.ts", import.meta.url),
    );
    const artPath = NodeURL.fileURLToPath(
      new URL("../../../mobile/fork/botMascotArt.ts", import.meta.url),
    );
    const [bots, art] = (await Promise.all([
      import(/* @vite-ignore */ botsPath),
      import(/* @vite-ignore */ artPath),
    ])) as [
      {
        readonly listNo3yBots: typeof webListSidebarBots;
        readonly no3yBotMascotShape: typeof webBotMascotShape;
        readonly no3yBotStatusLine: typeof webBotStatusLine;
        readonly no3yBotWorkStatusText: typeof webBotWorkStatusText;
      },
      { readonly botMascotSprite: typeof webBotMascotSprite },
    ];

    const older = withSource(
      threadFixture("bot-older", { createdAt: "2026-11-20T10:00:00.000Z" }),
      {
        tags: ["bot", "mascot:Heart"],
      },
    );
    const newer = withSource(
      threadFixture("bot-newer", { createdAt: "2026-11-21T10:00:00.000Z" }),
      {
        tags: ["bot"],
      },
    );
    const archivedBot = withSource(threadFixture("bot-archived", { archivedAt: NOW }), {
      tags: ["bot"],
    });
    const work = withSource(threadFixture("bot-work"), { tags: ["bot-work:bot-newer"] });
    const fixtures = [newer, work, archivedBot, threadFixture("plain"), older];

    const ids = (threads: ReadonlyArray<Thread>) => threads.map((thread) => thread.id);
    expect(ids(bots.listNo3yBots(fixtures))).toEqual(ids(webListSidebarBots(fixtures)));
    for (const thread of fixtures) {
      const shell = { id: thread.id, tags: thread.source.tags };
      expect(bots.no3yBotMascotShape(shell)).toBe(webBotMascotShape(shell));
    }
    // Petal cards say what the Mac's say, for every status, report and wake.
    const statuses = [
      "working",
      "preparing",
      "approval",
      "input",
      "request",
      "failed",
      "limited",
      "waiting",
      "ready",
    ] as const;
    const reports = [null, { text: "## **Done**: see [notes](https://x.test)\nmore" }];
    for (const status of statuses) {
      for (const report of reports) {
        for (const isUnread of [false, true]) {
          for (const nextWakeAt of [null, NOW]) {
            const input = {
              shell: { tags: ["bot"], latestVisibleMessage: report } as never,
              status,
              isUnread,
              nextWakeAt,
            };
            expect(bots.no3yBotStatusLine(input)).toEqual(webBotStatusLine(input));
          }
        }
      }
    }
    for (const attention of [
      { status: "approval", count: 1 },
      { status: "input", count: 1 },
      { status: "failed", count: 1 },
      { status: "failed", count: 3 },
    ] as const) {
      expect(bots.no3yBotWorkStatusText(attention)).toBe(webBotWorkStatusText(attention));
    }
    for (const shape of WEB_BOT_MASCOT_SHAPES) {
      for (const mood of WEB_BOT_MASCOT_MOODS) {
        expect(art.botMascotSprite(shape, mood)).toEqual(webBotMascotSprite(shape, mood));
      }
    }
  });

  it("files a thread under Chat exactly as web does", async () => {
    const chatRulePath = NodeURL.fileURLToPath(
      new URL("../../../mobile/fork/no3yChatRule.ts", import.meta.url),
    );
    const mobile = (await import(/* @vite-ignore */ chatRulePath)) as {
      readonly isNo3yChatThread: (thread: Thread, sentChatKeys?: ReadonlySet<string>) => boolean;
    };
    const tagged = withSource(threadFixture("tagged"), { tags: ["chat"] });
    const otherTag = withSource(threadFixture("other"), { tags: ["bot"] });
    const sent = threadFixture("sent");
    const plain = threadFixture("plain");
    const sentKeys = new Set([shellThreadKey(sent)]);
    for (const thread of [tagged, otherTag, sent, plain]) {
      expect(mobile.isNo3yChatThread(thread, sentKeys)).toBe(webIsChatThread(thread, sentKeys));
      expect(mobile.isNo3yChatThread(thread)).toBe(webIsChatThread(thread, new Set()));
    }
    expect(mobile.isNo3yChatThread(sent, sentKeys)).toBe(true);
    expect(mobile.isNo3yChatThread(plain, sentKeys)).toBe(false);
    // A phone chat is tagged `chat` once the server lists it, as the Mac tags its own.
    expect(readRepoFile("apps/mobile/fork/No3yChatRouteScreen.tsx")).toContain("tagNo3yChat(");
    expect(readRepoFile("apps/mobile/fork/no3yChatTagging.ts")).toContain(
      "input: { threadId, tag: NO3Y_CHAT_THREAD_TAG, tagged: true }",
    );
  });

  it("mounts the dock, Threads header, thread composer card, and model sheet in mobile seams", () => {
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
    const threadRoute = readRepoFile("apps/mobile/src/features/threads/ThreadRouteScreen.tsx");
    const threadHeader = readRepoFile("apps/mobile/src/features/threads/ThreadHeader.tsx");
    const threadComposer = readRepoFile("apps/mobile/src/features/threads/ThreadComposer.tsx");
    const threadSettings = readRepoFile("apps/mobile/src/features/threads/ThreadSettingsSheet.tsx");
    const screenHeader = readRepoFile("apps/mobile/fork/No3yScreenHeader.tsx");
    const globalCss = readRepoFile("apps/mobile/global.css");
    const fontFamilies = readRepoFile("apps/mobile/src/lib/fontFamilies.ts");
    const appearance = readRepoFile(
      "apps/mobile/src/features/settings/appearance/AppearancePreferencesProvider.tsx",
    );
    const statusMark = readRepoFile("apps/mobile/fork/No3yStatusMark.tsx");
    const composerStyle = readRepoFile("apps/mobile/fork/No3yComposerStyle.tsx");
    const listView = readRepoFile("apps/mobile/fork/No3yThreadsListView.tsx");
    const modelPicker = readRepoFile("apps/mobile/fork/No3yModelPicker.tsx");

    expect(stack).toContain('import { No3yBottomNavHost } from "../fork/No3yBottomNav";');
    expect(stack).toContain('import { No3yChatRouteScreen } from "../fork/No3yChatRouteScreen";');
    expect(stack).toContain("<No3yBottomNavHost state={props.state} />");
    expect(stack).toContain("No3yChat: createNativeStackScreen({");
    expect(nativeTabs).toContain("!compactTabs &&");
    expect(toolbar).toContain(
      '!(no3yBottomNav && !workspace.settingsOpen && selectedTab === "threads")',
    );
    // Four filled dock items; Settings moved to the Threads header.
    expect(dock).toContain('{ id: "automations", label: "Automations", icon: ZapIcon }');
    expect(dock).not.toContain('{ id: "settings"');
    expect(dock).toContain("filled />");
    expect(screenHeader).toContain('accessibilityLabel="Settings"');
    expect(toolbar).toContain('headerShown: selectedTab !== "threads"');
    expect(homeScreen).toContain("<No3yThreadsListView");
    // The dock draws the same Hugeicons release the Mac fork does.
    expect(mobilePackage.dependencies["@hugeicons/core-free-icons"]).toBe(
      webPackage.dependencies["@hugeicons/core-free-icons"],
    );
    expect(mobileGrouping).toContain('from "./forkRosterVisibility"');
    expect(mobileGrouping).toContain('from "./forkStatusGrouping"');
    expect(mobileGrouping).toContain("partitionForkStatusShelves(");
    // Threads search, filter and sort live in fork/No3yThreadsFilterBar.tsx; upstream stays as is.
    expect(filters).not.toContain("fork:begin");
    // Inside a thread there is no dock: the composer card sits low.
    expect(threadDetail).toContain(
      "no3yComposerBottomInset(upstreamComposerBottomInset, Boolean(props.draftMode))",
    );
    expect(threadRoute).toContain("<No3yThreadTitleStyle />");
    // The ring follows the composer's model and shows the limit that will interrupt first.
    expect(threadRoute).toContain(
      "providerInstanceId: (selectedThreadWithDraftSettings ?? selectedThread)",
    );
    expect(screenHeader).toContain("no3yRingUsageWindow(driver, account.limits.windows)");
    // One usage button opening the half-height usage sheet, and a ⋯ menu holding the rest.
    expect(threadHeader).toContain("useNo3yThreadBar(");
    expect(screenHeader).toContain('icon: "ellipsis"');
    // No native bar in a thread: back, title and usage + ⋯ float as glass bubbles over a top fade,
    // and the transcript's top inset is the floating row's.
    expect(threadHeader).toContain("if (no3yBar) return <No3yThreadHeader");
    expect(screenHeader).toContain("<NativeStackScreenOptions options={{ headerShown: false }} />");
    expect(screenHeader).toContain("<HeaderHeightContext value={props.draft ? 0 : inset}>");
    expect(threadRoute).toContain("<No3yThreadBarInset draft=");
    expect(screenHeader).toContain('StackActions.push("No3yUsage", driver === undefined');
    expect(readRepoFile("apps/mobile/fork/No3yUsageSheet.tsx")).not.toContain("peekRing");
    expect(stack).toContain("No3yUsage: createNativeStackScreen({");
    // The usage sheet is the Mac drawer's compact rows in a half sheet that scrolls, refreshed
    // on open, with explicit checking / offline / empty states.
    expect(stack).not.toContain('sheetAllowedDetents: "fitToContents",');
    expect(readRepoFile("apps/mobile/fork/No3yUsageSheet.tsx")).toContain("no3yUsageSheetState({");
    expect(screenHeader).toContain("limitsAutoRefreshSetAtom(String(usage.environmentId))");
    const usageSheet = readRepoFile("apps/mobile/fork/No3yUsageSheet.tsx");
    expect(usageSheet).toContain("compactTrayWindows(pool)");
    expect(usageSheet).toContain('const CALM_GREEN = "#38a169";');
    // Glass controls and card, the looping working mark.
    expect(composerStyle).toContain("<No3yGlassLayer");
    expect(threadComposer).toContain("<No3yGlassLayer radius={targetBorderRadius} />");
    expect(threadComposer).toContain("<No3yBottomScrim");
    expect(threadComposer).toContain("paddingHorizontal={no3yCard ? NO3Y_CARD_INSET : 0}");
    expect(statusMark).toContain("<No3yBeadRing");
    // Card-size status marks are 20pt, scaled whole from their 16pt drawing.
    expect(statusMark).toContain("const size = props.size ?? NO3Y_STATUS_MARK_SIZE;");
    expect(readRepoFile("apps/mobile/fork/flatGlassTheme.ts")).toContain(
      "export const NO3Y_STATUS_MARK_SIZE = 20;",
    );
    // Pull requests from the Threads header, bots above the sections, access on New agent.
    expect(screenHeader).toContain('selectTab("pullRequests")');
    expect(dock).toContain('selectNo3yWorkspaceTab("threads", openWorkspaceTab)');
    // Dock switches are a plain swap: the native push or pop is off for them, and nothing fades.
    expect(dock).toContain("markNo3yDockSwitch();");
    expect(stack).toContain("...no3yDockScreenOptions(),");
    // Never fade an ancestor of glass: a UIGlassEffect installed mid-fade never renders.
    expect(readRepoFile("apps/mobile/fork/No3yStatusPill.tsx")).not.toContain("NO3Y_FADE_IN");
    expect(readRepoFile("apps/mobile/fork/No3yBottomNav.tsx")).toContain("NO3Y_GLASS_RISE_IN");
    expect(listView).toContain("<No3yBotsGrid");
    expect(readRepoFile("apps/mobile/fork/No3yBotsGrid.tsx")).toContain("<PetalCard");
    expect(readRepoFile("apps/mobile/fork/No3yThreadRow.tsx")).not.toContain(
      'statusKind === "limited" ? palette.statusAttention : palette.statusFailed',
    );
    // Access lives on the model chip and in the model sheet, for threads and New agent drafts,
    // with the Mac's icons and weights: Full access's crossed shield stays a stroke.
    expect(composerStyle).toContain("<No3yAccessIcon mode={card.runtimeMode}");
    expect(modelPicker).toContain("<No3yAccessIcon mode={session.runtimeMode}");
    // Composer controls are a step smaller than the 44pt controls elsewhere; the shields all fill.
    expect(composerStyle).toContain("width: NO3Y_COMPOSER_CONTROL_SIZE,");
    expect(threadComposer).toContain(
      "const NO3Y_CARD_CONTROLS_CLEARANCE = 44 / 2 + NO3Y_COMPOSER_CONTROL_SIZE / 2 + NO3Y_CARD_INSET;",
    );
    const access = readRepoFile("apps/mobile/fork/No3yAccess.tsx");
    expect(access).toContain('"approval-required": { icon: SquareLock02Icon, filled: true },');
    expect(access).toContain('"full-access": { icon: ShieldOffIcon, filled: false },');
    expect(modelPicker).toContain("onSelect={session.onUpdateRuntimeMode}");
    expect(threadComposer).toContain("runtimeMode: props.selectedThread.runtimeMode");
    // The composer chip opens the half-sheet model picker on iPhone.
    expect(threadSettings).toContain("<No3yModelPickerHost onClose={props.onClose} />");
    expect(stack).toContain('sheetRoute({ detent: 0.5, maxDetent: 0.5, header: "none" })');
    // The compact status pill replaces the floating control on the no3y layout and opens its sheet.
    const statusPill = readRepoFile("apps/mobile/fork/No3yStatusPill.tsx");
    expect(threadDetail).toContain("<No3yStatusPillSwap");
    expect(threadDetail).toContain("enabled={no3yBottomNav}");
    expect(stack).toContain("No3yThreadStatus: createNativeStackScreen({");
    expect(statusPill).toContain('StackActions.push("No3yThreadStatus", { threadKey })');
    expect(statusPill).toContain("subagents: Robot01Icon");
    expect(statusPill).toContain("<No3yGlassLayer radius={PILL_HEIGHT / 2} />");
    // The user's bubble is a translucent wash on the no3y layout.
    expect(readRepoFile("apps/mobile/src/features/threads/ThreadFeed.tsx")).toContain(
      "flatGlassPalette(themeAppearance).userBubble",
    );
    // A live turn ends in one status line; the live row moves last and draws as it.
    const feed = readRepoFile("apps/mobile/src/features/threads/ThreadFeed.tsx");
    expect(feed).toContain("no3yLiveLast ? no3yLiveRowLast(presentation) : presentation");
    expect(feed).toContain("<No3yLiveStatusLine");
    // Automations: the fork screen, runs pushed over it so back returns there, grouped-card washed.
    const scheduled = readRepoFile(
      "apps/mobile/src/features/settings/SettingsScheduledTasksRouteScreen.tsx",
    );
    const automations = readRepoFile("apps/mobile/fork/No3yAutomationsScreen.tsx");
    expect(scheduled).toContain("<No3yAutomationsScreen");
    expect(automations).toContain(
      'navigation.dispatch(StackActions.push("Thread", detail.params));',
    );
    // Automations | Runs: automations as tiles with the fork Switch, runs as a compact table.
    expect(automations).toContain("<TabSwitch tab={tab}");
    expect(automations).toContain("<AutomationTile");
    expect(automations).toContain('const SWITCH_ON = "#00bc7d";');
    expect(automations).toContain("<RunRow");
    expect(readRepoFile("apps/mobile/fork/no3yPageColor.ts")).toContain(
      '"--color-grouped-card": NO3Y_CARD_COLOR,',
    );
    // Transcript subagents draw as the Mac fork's card with the Threads list's status marks.
    const workLog = readRepoFile("apps/mobile/src/features/threads/thread-work-log.tsx");
    const subagentCards = readRepoFile("apps/mobile/fork/No3ySubagentCards.tsx");
    expect(workLog).toContain("<No3ySubagentCardsSwap");
    expect(subagentCards).toContain("<No3yStatusMark kind={mark} palette={palette} size={14} />");
    expect(subagentCards).toContain("<No3yProviderMark");
    expect(subagentCards).not.toContain("sky");
    // No latest-activity line on the card.
    expect(subagentCards).not.toContain("no3ySubagentActivity");
    expect(subagentCards).toContain("borderRadius: 20,");
    // Chat: Threads' header shape, thread cards, and New agent's draft composer for a No-project
    // chat, served by the new-task flow and kept alive with its route.
    const chat = readRepoFile("apps/mobile/fork/No3yChatRouteScreen.tsx");
    const draftScreen = readRepoFile("apps/mobile/src/features/threads/NewTaskDraftScreen.tsx");
    expect(chat).toContain("<NewTaskDraftRouteScreen");
    expect(chat).toContain("<No3yChatHeader");
    expect(chat).toContain("<No3yThreadRow");
    expect(stack).toContain("isDraftThreadRoute(route) || isNo3yChatDraftRoute(route)");
    expect(readRepoFile("apps/mobile/src/features/threads/new-task-flow-state.ts")).toContain(
      "isNo3yChatDraftRoute(route)",
    );
    expect(draftScreen).toContain("content: no3ySurface?.content ?? heroViewport,");
    expect(draftScreen).toContain("no3ySurface.onSubmitted(");
    // New agent: its header with Search, project tiles in place of the hero, and glass worktree,
    // branch and machine pills above the composer in place of the context controls.
    const newAgent = readRepoFile("apps/mobile/fork/No3yNewAgent.tsx");
    expect(readRepoFile("apps/mobile/fork/No3yDraftSurface.tsx")).toContain(
      "return chat ?? (enabled ? NO3Y_NEW_AGENT_SURFACE : null);",
    );
    expect(draftScreen).toContain("no3ySurface.controls");
    expect(newAgent).toContain("rankNo3yProjectTiles({");
    expect(newAgent).toContain("controls: <DraftPills />,");
    expect(newAgent).toContain("header: <NewAgentHeader />,");
    // iOS draws the system font everywhere; Android keeps DM Sans.
    expect(globalCss).toContain('--font-sans: "System";');
    expect(fontFamilies).toContain('regular: "System", medium: "System", bold: "System"');
    expect(mobilePackage.dependencies["@expo-google-fonts/geist"]).toBeUndefined();
    // One page colour across the iOS screens, in both CSS and JS theme variables.
    expect(appearance).toContain("withNo3yPageColor(variables, appearance, Platform.OS)");
    expect(appearance).toContain("Uniwind.updateCSSVariables(themeName, no3yDarkPageVariables())");
  });
});
