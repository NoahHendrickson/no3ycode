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
  botWorkAttentionByBot,
  botWorkStatusText,
  groupBotWork,
  withBotWorkAttention,
} from "../custom/bots/botWork";
import { BOT_WORK_TAG_PREFIX, botWorkRowThreadId } from "../custom/bots/botWorkRoster";
import { BOT_THREAD_TAG } from "../custom/bots/botThreads";
import { resolveSidebarV2CardStatus } from "../custom/sidebarV2CardStatus";
import { makeThreadFixture } from "../test-fixtures";
import type { Thread } from "../types";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const chatView = readSibling("../components/ChatView.tsx");
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
    ];
    const attention = botWorkAttentionByBot(threads).get("environment-test:mail");
    expect(attention).toEqual({ status: "approval", count: 3 });
    expect(botWorkStatusText(attention!)).toBe("3 threads need you");
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

  it("keeps the server's link at launch and the panel in the stage", () => {
    expect(launch).toContain("yield* linkForkBotWork(threads, {");
    expect(mcp).toContain("yield* linkForkBotWork(threadManagement, {");
    expect(launchTool).toContain("{ launchedBy: caller.id }");
    expect(chatView).toContain("<BotThreadsPanel");
    expect(panelControls).toContain("<BotThreadsPanelToggle threadRef={botThreadsThreadRef} />");
    expect(inlineSize).toContain("row.clientWidth - otherInlinePanelsWidth(row, host)");
  });
});
