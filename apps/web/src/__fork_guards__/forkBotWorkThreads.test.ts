// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/README.md` §4b and `.fork/customizations.yaml#fork-bot-work-threads`.
 * A bot's launched threads stay off the sidebar while their bot lists, its card says when they
 * need the owner, and its Threads panel groups them; the server tags them at launch.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { ProviderInstanceId, RunId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { filterSidebarV2VisibleThreads } from "../components/Sidebar.logic";
import { resolveSidebarRouteReveal } from "../components/sidebar/routeReveal";
import {
  botThreadsPanelBotId,
  botWorkAttentionByBot,
  botWorkStatusText,
  filterBotWork,
  groupBotWork,
  withBotWorkAttention,
} from "../custom/bots/botWork";
import { botSeedFiles } from "../custom/bots/botSeedFiles";
import { BOT_WORK_TAG_PREFIX, botWorkRowThreadId } from "../custom/bots/botWorkRoster";
import { BOT_THREAD_TAG } from "../custom/bots/botThreads";
import {
  BOT_THREADS_PANEL_MIN_WIDTH,
  CONVERSATION_MIN_BESIDE_TWO_PANELS,
  inlinePanelRoom,
  stageFitsBothPanels,
} from "../custom/bots/stagePanels";
import { resolveSidebarV2CardStatus } from "../custom/sidebarV2CardStatus";
import { makeThreadFixture } from "../test-fixtures";
import type { Thread } from "../types";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const chatView = readSibling("../components/ChatView.tsx");
const sidebar = readSibling("../components/Sidebar.tsx");
const panelControls = readSibling("../components/chat/PanelLayoutControls.tsx");
const inlineSize = readSibling("../hooks/usePreviewPanelInlineSize.ts");
const launch = readSibling("../../../server/src/orchestration-v2/ThreadLaunchService.ts");
const mcp = readSibling("../../../server/src/mcp/OrchestratorMcpService.ts");
const launchTool = readSibling("../../../server/src/mcp/toolkits/project/handlers.ts");

const AT = "2026-11-14T12:00:00.000Z";

function runtime(status: "running" | "failed"): NonNullable<Thread["runtime"]> {
  return {
    status,
    activeRunId: null,
    providerInstanceId: ProviderInstanceId.make("codex"),
    providerName: null,
    lastError: null,
    updatedAt: AT,
  };
}

function withTags(thread: Thread, tags: ReadonlyArray<string>): Thread {
  return { ...thread, source: { ...thread.source, tags } };
}

function bot(id: string, overrides: Partial<Thread> = {}): Thread {
  return withTags(makeThreadFixture({ id: id as Thread["id"], ...overrides }), [BOT_THREAD_TAG]);
}

/** A thread the bot `owner` launched. */
function work(id: string, owner: string, overrides: Partial<Thread> = {}): Thread {
  return withTags(makeThreadFixture({ id: id as Thread["id"], ...overrides }), [
    `${BOT_WORK_TAG_PREFIX}${owner}`,
  ]);
}

const ids = (threads: ReadonlyArray<Thread>) => threads.map((thread) => thread.id);

describe("fork guard: fork-bot-work-threads", () => {
  it("keeps a bot's work off the sidebar while its bot lists, unless pinned", () => {
    const threads = [
      makeThreadFixture({ id: "mine" as Thread["id"] }),
      bot("mail"),
      work("mail-fix", "mail"),
      work("mail-kept", "mail", { pinnedAt: AT }),
      bot("retired", { archivedAt: AT }),
      work("retired-fix", "retired"),
      work("orphan-fix", "deleted-bot"),
    ];
    expect(ids(filterSidebarV2VisibleThreads(threads, null, new Set()))).toEqual([
      "mine",
      "mail-kept",
      "retired-fix",
      "orphan-fix",
    ]);
    // The collapsed tab strip lists no bots, so there a bot's work keeps its tabs.
    expect(ids(filterSidebarV2VisibleThreads(threads, null, new Set(), undefined, false))).toEqual([
      "mine",
      "mail-fix",
      "mail-kept",
      "retired-fix",
      "orphan-fix",
    ]);
  });

  it("never widens the project scope for work the sidebar leaves out", () => {
    const threads = [
      bot("mail"),
      work("mail-fix", "mail"),
      makeThreadFixture({ id: "mine" as Thread["id"] }),
    ];
    const reveal = (key: string) =>
      resolveSidebarRouteReveal({
        reveal: { observedKey: null, pendingKey: null },
        routeKey: key,
        isSearching: false,
        scopedProjectKeys: new Set(["environment-test:another-project"]),
        delegatedUnderParent: new Set(),
        findThread: (candidate) =>
          threads.find((thread) => `${thread.environmentId}:${thread.id}` === candidate),
      });
    expect(reveal("environment-test:mail-fix").widensScope).toBe(false);
    expect(reveal("environment-test:mine").widensScope).toBe(true);
  });

  it("lights the bot's card while one of its threads is open", () => {
    const threads = [bot("mail"), work("mail-fix", "mail"), work("kept", "mail", { pinnedAt: AT })];
    const env = threads[0]!.environmentId;
    expect(botWorkRowThreadId(ThreadId.make("mail-fix"), env, threads)).toBe("mail");
    expect(botWorkRowThreadId(ThreadId.make("kept"), env, threads)).toBe("kept");
  });

  it("puts what needs the owner on the bot's card ahead of its idle states", () => {
    const threads = [
      bot("mail"),
      work("asks", "mail", { hasPendingUserInput: true }),
      work("approves", "mail", { hasPendingApprovals: true }),
      work("broke", "mail", { runtime: runtime("failed") }),
      work("pinned", "mail", { hasPendingApprovals: true, pinnedAt: AT }),
      work("settled", "mail", { runtime: runtime("failed"), settledOverride: "settled" }),
      // Settled, then blocked on the owner again: it counts. A failure opened since does not.
      work("asks-again", "mail", { hasPendingUserInput: true, settledOverride: "settled" }),
      work("read", "mail", {
        runtime: runtime("failed"),
        updatedAt: "2026-11-14T10:00:00.000Z",
        lastVisitedAt: AT,
      }),
    ];
    const attention = botWorkAttentionByBot(threads).get("environment-test:mail");
    expect(attention).toEqual({ status: "approval", count: 4 });
    expect(botWorkStatusText(attention!)).toBe("4 threads need you");
    const sections = new Map(
      groupBotWork(
        threads,
        { environmentId: "environment-test", threadId: "mail" },
        () => undefined,
      ).map((group) => [group.key, ids(group.rows.map((row) => row.thread))]),
    );
    expect(sections.get("settled")).toEqual(["settled"]);
    expect(sections.get("input")).toContain("asks-again");
    expect(botWorkStatusText({ status: "failed", count: 1 })).toBe("A thread failed");

    const idle = resolveSidebarV2CardStatus(bot("mail"), {
      lastVisitedAt: undefined,
      wokeAt: null,
    });
    expect(withBotWorkAttention(idle, attention)).toMatchObject({
      status: "approval",
      topStatus: { label: "Needs approval" },
      botWork: attention,
    });
    const busy = resolveSidebarV2CardStatus(bot("mail", { runtime: runtime("running") }), {
      lastVisitedAt: undefined,
      wokeAt: null,
    });
    expect(withBotWorkAttention(busy, attention)).toMatchObject({
      status: "working",
      botWork: null,
    });
  });

  it("groups a bot's work by the sidebar's status sections, what needs the owner first", () => {
    const completedRun = {
      runId: RunId.make("run:done"),
      status: "completed" as const,
      requestedAt: "2026-11-14T10:00:00.000Z",
      startedAt: "2026-11-14T10:00:00.000Z",
      completedAt: "2026-11-14T10:05:00.000Z",
      assistantMessageId: null,
    };
    const threads = [
      bot("mail"),
      work("running", "mail", { runtime: runtime("running") }),
      work("done", "mail", {
        runtime: null,
        latestRun: completedRun,
        lastVisitedAt: "2026-11-14T09:00:00.000Z",
      }),
      work("asks", "mail", { hasPendingUserInput: true }),
      makeThreadFixture({
        id: "helper" as Thread["id"],
        runtime: runtime("running"),
        lineage: {
          rootThreadId: ThreadId.make("mail"),
          parentThreadId: ThreadId.make("mail"),
          relationshipToParent: "subagent",
        },
      }),
      work("put-away", "mail", { archivedAt: AT }),
      work("elsewhere", "gym", { runtime: runtime("running") }),
    ];
    const groups = groupBotWork(
      threads,
      { environmentId: "environment-test", threadId: "mail" },
      (thread) => thread.lastVisitedAt ?? undefined,
    );
    expect(groups.map((group) => [group.label, ids(group.rows.map((row) => row.thread))])).toEqual([
      ["Needs input", ["asks"]],
      ["Completed", ["done"]],
      ["Working", ["running", "helper"]],
    ]);
    expect(
      groupBotWork(
        threads,
        { environmentId: "environment-test", threadId: "gym" },
        () => undefined,
      ),
    ).toHaveLength(1);
    expect(
      groupBotWork(
        [bot("new")],
        { environmentId: "environment-test", threadId: "new" },
        () => undefined,
      ),
    ).toEqual([]);
  });

  it("orders each section by the chosen sort, and narrows by search, status and project", () => {
    const at = (minute: number) => `2026-11-14T10:${String(minute).padStart(2, "0")}:00.000Z`;
    const row = (id: string, created: number, active: number, extra: Partial<Thread> = {}) =>
      work(id, "mail", {
        title: id,
        createdAt: at(created),
        updatedAt: at(active),
        latestUserMessageAt: at(active),
        runtime: runtime("running"),
        ...extra,
      });
    const threads = [
      bot("mail"),
      row("Beta", 1, 30),
      row("alpha", 2, 10, { branch: "t3/Retry-Webhooks" }),
      row("gamma", 3, 20, { projectId: "other" as Thread["projectId"] }),
      row("asks", 4, 40, { runtime: null, hasPendingUserInput: true }),
    ];
    const mail = { environmentId: "environment-test", threadId: "mail" };
    const working = (sort: Parameters<typeof groupBotWork>[3]) =>
      ids(
        groupBotWork(threads, mail, () => undefined, sort)
          .find((group) => group.key === "working")!
          .rows.map((entry) => entry.thread),
      );
    expect(working(undefined)).toEqual(["Beta", "gamma", "alpha"]);
    expect(working("newest")).toEqual(["gamma", "alpha", "Beta"]);
    expect(working("oldest")).toEqual(["Beta", "alpha", "gamma"]);
    expect(working("title")).toEqual(["alpha", "Beta", "gamma"]);

    const groups = groupBotWork(threads, mail, () => undefined);
    const none = { query: "", groups: new Set<never>(), projectIds: new Set<string>() };
    const kept = (filter: Partial<Parameters<typeof filterBotWork>[1]>) =>
      filterBotWork(groups, { ...none, ...filter }).map((group) => [
        group.key,
        ids(group.rows.map((entry) => entry.thread)),
      ]);
    expect(filterBotWork(groups, none)).toBe(groups);
    // A query matches a title or a branch, in any case; a section left empty is dropped.
    expect(kept({ query: " BET " })).toEqual([["working", ["Beta"]]]);
    expect(kept({ query: "webhooks" })).toEqual([["working", ["alpha"]]]);
    expect(kept({ groups: new Set(["input"] as const) })).toEqual([["input", ["asks"]]]);
    expect(kept({ projectIds: new Set(["other"]) })).toEqual([["working", ["gamma"]]]);
    expect(kept({ query: "nothing" })).toEqual([]);
  });

  it("keeps the server's link at launch and the panel in the stage", () => {
    expect(launch).toContain("yield* linkForkBotWork(threads, {");
    expect(mcp).toContain("yield* linkForkBotWork(threadManagement, {");
    expect(launchTool).toContain("{ launchedBy: caller.id }");
    // A bot's own rules send real work to a thread it launches; no other thread reads them.
    const rules = botSeedFiles({ name: "Mail Bot", today: "2026-11-14", threadId: "mail" })[0];
    expect(rules?.relativePath).toBe("CLAUDE.md");
    expect(rules?.contents).toContain("**Start a thread** with `t3_thread_launch`");
    // The bot's own limits stop at the bot, so each prompt has to carry them.
    expect(rules?.contents).toContain("Your limits do not travel with it");
    expect(chatView).toContain("<BotThreadsPanel");
    expect(sidebar).toContain("if (props.botWork != null) openBotThreadsPanel(threadRef);");
    expect(panelControls).toContain("<BotThreadsPanelToggle threadRef={botThreadsThreadRef} />");
    // The Threads panel counts the right panel at its minimum, so the list keeps its width.
    expect(inlineSize).toContain("otherInlinePanelsWidth(row, host, options.otherPanels)");
    expect(readSibling("../custom/bots/BotThreadsPanel.tsx")).toContain('otherPanels: "minimum"');
    expect(inlineSize).toContain("readonly floorWidth?: number | undefined;");
  });

  it("keeps the conversation widest with both panels open, and holds one panel where both do not fit", () => {
    // The sizing hook keeps 360px of the room for the conversation, and caps a panel at the rest.
    const cap = (rowWidth: number, otherPanelsWidth: number, floor: number) =>
      Math.max(floor, inlinePanelRoom({ rowWidth, otherPanelsWidth, siblingMinWidth: 360 }) - 360);
    // One panel alone: the row less 360, as on custom.
    expect(inlinePanelRoom({ rowWidth: 1184, otherPanelsWidth: 0, siblingMinWidth: 360 })).toBe(
      1184,
    );
    // Both open, the conversation keeps 480: the right panel beside a 320px Threads panel.
    expect(cap(1184, 320, 360)).toBe(384);
    expect(1184 - 320 - cap(1184, 320, 360)).toBe(CONVERSATION_MIN_BESIDE_TWO_PANELS);
    expect(cap(1440, 320, 360)).toBe(640);
    // The Threads panel beside the right panel goes down to its own 280.
    expect(cap(1184, 540, BOT_THREADS_PANEL_MIN_WIDTH)).toBe(BOT_THREADS_PANEL_MIN_WIDTH);
    expect(stageFitsBothPanels(1120)).toBe(true);
    expect(stageFitsBothPanels(1119)).toBe(false);
  });

  it("shows a bot's panel on the bot and on each of its threads, and nowhere else", () => {
    const isBot = (id: string) => id === "mail";
    const subagentOf = (parent: string) =>
      makeThreadFixture({
        id: "helper" as Thread["id"],
        lineage: {
          rootThreadId: ThreadId.make(parent),
          parentThreadId: ThreadId.make(parent),
          relationshipToParent: "subagent",
        },
      });
    expect(botThreadsPanelBotId(bot("mail"), isBot)).toBe("mail");
    expect(botThreadsPanelBotId(work("fix", "mail"), isBot)).toBe("mail");
    expect(botThreadsPanelBotId(work("kept", "mail", { pinnedAt: AT }), isBot)).toBe("mail");
    expect(botThreadsPanelBotId(subagentOf("mail"), isBot)).toBe("mail");
    expect(botThreadsPanelBotId(subagentOf("plain"), isBot)).toBeNull();
    expect(botThreadsPanelBotId(work("orphan", "gone"), isBot)).toBeNull();
    expect(
      botThreadsPanelBotId(makeThreadFixture({ id: "mine" as Thread["id"] }), isBot),
    ).toBeNull();
  });
});
