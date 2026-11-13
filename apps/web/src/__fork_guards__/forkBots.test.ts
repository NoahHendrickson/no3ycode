// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/README.md` §4b and `.fork/customizations.yaml#fork-bots`.
 * Bots stay out of the thread roster, quiet wakes stay silent, and the seeded folder keeps its hooks.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { MessageId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { filterSidebarV2VisibleThreads } from "../components/Sidebar.logic";
import {
  BOT_MASCOT_MOODS,
  BOT_MASCOT_SHAPES,
  botMascotFromMenuId,
  botMascotMenuItem,
  botMascotMood,
  botMascotRows,
  botMascotShape,
  botMascotSprite,
  botMascotTag,
  botMascotTagWrites,
  nextBotMascotShape,
} from "../custom/bots/botMascots";
import { botSeedFiles } from "../custom/bots/botSeedFiles";
import {
  hasUnseenBotReport,
  noteBotReport,
  resetBotReportsForTest,
} from "../custom/bots/botReports";
import {
  BOT_QUIET_REPLY,
  BOT_THREAD_TAG,
  botFolderName,
  botFolderPath,
  botStatusLine,
  isBotThread,
  isQuietBotReport,
  listSidebarBots,
} from "../custom/bots/botThreads";
import { makeThreadFixture } from "../test-fixtures";
import type { Thread } from "../types";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const sidebar = readSibling("../components/Sidebar.tsx");
const notifications = readSibling("../components/ThreadNotificationCoordinator.tsx");
const cardStatus = readSibling("../custom/sidebarV2CardStatus.ts");
const chatView = readSibling("../components/ChatView.tsx");
const composerSend = readSibling("../components/chat/useComposerSend.ts");
const timeline = readSibling("../components/chat/MessagesTimeline.tsx");
const detailsPanel = readSibling("../components/chat/ThreadDetailsPanel.tsx");

function bot(
  id: string,
  overrides: Partial<Thread> = {},
  lastWord?: string,
  extraTags: ReadonlyArray<string> = [],
): Thread {
  const thread = makeThreadFixture({ id: id as Thread["id"], ...overrides });
  return {
    ...thread,
    source: {
      ...thread.source,
      tags: [BOT_THREAD_TAG, ...extraTags],
      latestVisibleMessage:
        lastWord === undefined
          ? null
          : {
              id: MessageId.make(`message:${id}`),
              role: "assistant",
              text: lastWord,
              updatedAt: thread.source.updatedAt,
            },
    },
  };
}

describe("fork guard: fork-bots", () => {
  it("keeps bots out of the thread roster and lists them in their own section", () => {
    const threads = [
      makeThreadFixture({ id: "mine" as Thread["id"] }),
      bot("mail", { createdAt: "2026-11-02T00:00:00.000Z" }),
      bot("gym", { createdAt: "2026-11-01T00:00:00.000Z" }),
      bot("retired", { archivedAt: "2026-11-03T00:00:00.000Z" }),
    ];
    expect(
      filterSidebarV2VisibleThreads(threads, null, new Set()).map((thread) => thread.id),
    ).toEqual(["mine"]);
    expect(listSidebarBots(threads).map((thread) => thread.id)).toEqual(["gym", "mail"]);
    expect(isBotThread(threads[0]!)).toBe(false);
  });

  it("says what a bot is doing, did last or does next, never model or branch", () => {
    const line = (thread: Thread, status = "ready", nextWakeAt: string | null = null) =>
      botStatusLine({ thread, status, nextWakeAt });
    const report = bot("r", {}, "## **Inbox**: 3 new from [Sam](https://x.y)\n\nMore detail");
    expect(line(report)).toEqual({ text: "Inbox: 3 new from Sam" });
    expect(line(report, "working")).toEqual({ text: "Working on it…" });
    expect(line(report, "approval")).toEqual({ text: "Needs your approval" });
    expect(line(report, "failed")).toEqual({ text: "Last run failed" });
    // A quiet wake shows the next one instead, when one is scheduled.
    const quiet = bot("q", {}, BOT_QUIET_REPLY);
    expect(line(quiet, "ready", "2026-11-14T09:00:00Z")).toEqual({
      nextWakeAt: "2026-11-14T09:00:00Z",
    });
    expect(line(quiet)).toEqual({ text: "Nothing to report" });
    expect(line(bot("new"))).toEqual({ text: "Tell it what its job is" });
    expect(sidebar).toContain("<BotCardStatusLine");
    expect(sidebar).toContain("<BotMascotAvatar");
    // The avatar card is 44px, 6 + 16 + 2 + 14 + 6, so its offscreen size hint says so too.
    expect(sidebar).toContain("[contain-intrinsic-size:auto_44px]");
    // The status mark's column spans both lines, so the status text stops short of it.
    expect(sidebar).toContain("[&>[data-fork-bot-title-row]>:last-child]:row-span-2");
    // Bots keep their own density: the threads' Compact cards never folds them.
    expect(sidebar).toMatch(/isBotThread\(thread\)\s*\?\s*compactBots/);
  });

  it("treats only the bare quiet reply from a bot as a silent wake", () => {
    expect(isQuietBotReport(bot("a", {}, BOT_QUIET_REPLY))).toBe(true);
    expect(isQuietBotReport(bot("b", {}, "  nothing to report  "))).toBe(true);
    expect(isQuietBotReport(bot("c", {}, "Nothing to report. But your rent is due."))).toBe(false);
    expect(isQuietBotReport(bot("d"))).toBe(false);
    const thread = makeThreadFixture({ id: "plain" as Thread["id"] });
    expect(
      isQuietBotReport({
        source: {
          tags: [],
          latestVisibleMessage: { role: "assistant", text: BOT_QUIET_REPLY },
        },
      }),
    ).toBe(false);
    expect(isQuietBotReport(thread)).toBe(false);
  });

  it("keeps a report unread through a later quiet wake, until the bot is opened", () => {
    resetBotReportsForTest();
    const reported = bot("mail", {}, "Your rent is due Friday.");
    noteBotReport("env:mail", reported, Date.parse("2026-11-13T08:00:00.000Z"));
    // The quiet wake that follows is not a report and does not replace the one before it.
    noteBotReport(
      "env:mail",
      bot("mail", {}, BOT_QUIET_REPLY),
      Date.parse("2026-11-13T09:00:00.000Z"),
    );
    expect(hasUnseenBotReport("env:mail", "2026-11-13T07:00:00.000Z")).toBe(true);
    expect(hasUnseenBotReport("env:mail", "2026-11-13T08:30:00.000Z")).toBe(false);
    expect(hasUnseenBotReport("env:mail", undefined)).toBe(false);
    expect(hasUnseenBotReport("env:other", "2026-11-13T07:00:00.000Z")).toBe(false);
    resetBotReportsForTest();
  });

  it("silences quiet wakes in notifications and in the card's unread mark", () => {
    expect(notifications).toContain("isQuietBotReport({ source: state.raw })");
    expect(cardStatus).toContain("const isUnread = isQuietBotReport(thread)");
    expect(notifications).toContain("noteBotReport(");
  });

  it("paints Bots above a collapsible Threads section, outside Chat", () => {
    expect(sidebar).toContain("if (modePolicy.chat || botListElement === null) return items;");
    expect(sidebar).toContain("<SidebarV2BotsRow");
    expect(sidebar).toContain('onToggleCollapsed={() => toggleListSectionCollapsed("threads")}');
    expect(sidebar).toContain("...(threadsSectionCollapsed ? [] : items),");
    expect(chatView).toContain('data-fork-bot-thread={isForkBotThread ? "" : undefined}');
  });

  it("keeps the name a bot was given through its first send", () => {
    expect(composerSend).toContain(
      "isBotThreadRef(scopeThreadRef(environmentId, threadIdForSend))",
    );
  });

  it("draws each mascot as the brand file's generator does, and reads its mood off the thread", () => {
    // Classic is the brand leaf at its own 9×13, with eyes where the veins were.
    expect(botMascotRows("Classic", "Idle")).toEqual([
      "....k....",
      "...kbk...",
      "..kbbhk..",
      ".kbbbbhk.",
      "kbbbbbbhk",
      "kbwkbwkhk",
      "kbkkbkkhk",
      "kbkkbkkhk",
      "kbbbbbbbk",
      ".kbbbbbk.",
      "..kbkbk..",
      "...kkk...",
      "....k....",
    ]);
    // Every shape draws in every mood, on its own unchanged outline.
    for (const shape of BOT_MASCOT_SHAPES) {
      const idle = botMascotSprite(shape, "Idle");
      for (const mood of BOT_MASCOT_MOODS) {
        const sprite = botMascotSprite(shape, mood);
        expect([sprite.width, sprite.height]).toEqual([idle.width, idle.height]);
        expect(sprite.paths.length).toBeGreaterThan(2);
      }
      // One CSS pixel per cell must fit the card's lead slot (22px wide, 18px line plus padding).
      expect(idle.width).toBeLessThanOrEqual(22);
      expect(idle.height).toBeLessThanOrEqual(20);
    }
    expect(botMascotShape(bot("tagged", {}, undefined, ["mascot:Sakura"]))).toBe("Sakura");
    expect(BOT_MASCOT_SHAPES).toContain(botMascotShape(bot("untagged")));
    expect(botMascotShape(bot("untagged"))).toBe(botMascotShape(bot("untagged")));
    expect(nextBotMascotShape(["Classic", "Round"])).toBe("Willow");
    expect(botMascotTag("Sakura")).toBe("mascot:Sakura");
    // Changing a mascot sets the new tag, then clears every other one.
    expect(botMascotTagWrites(bot("tagged", {}, undefined, ["mascot:Sakura"]), "Round")).toEqual([
      { tag: "mascot:Round", tagged: true },
      { tag: "mascot:Sakura", tagged: false },
    ]);
    expect(botMascotTagWrites(bot("tagged", {}, undefined, ["mascot:Sakura"]), "Sakura")).toEqual(
      [],
    );
    const menu = botMascotMenuItem(bot("tagged", {}, undefined, ["mascot:Sakura"]), true);
    expect(menu.children.filter((item) => item.checked).map((item) => item.label)).toEqual([
      "Sakura",
    ]);
    expect(menu.children.map((item) => botMascotFromMenuId(item.id))).toEqual(BOT_MASCOT_SHAPES);
    expect(botMascotFromMenuId("rename")).toBeNull();
    expect(sidebar).toContain("setBotMascot(thread, mascot)");
    expect(detailsPanel).toContain("<BotMascotDetailsSection threadRef={activeThreadRef} />");
    const mood = (status: string, isUnread = false, resting = true) =>
      botMascotMood({ status, isUnread, resting });
    expect(mood("working")).toBe("Thinking");
    expect(mood("failed", true)).toBe("Error");
    expect(mood("ready", true)).toBe("Happy");
    expect(mood("ready")).toBe("Sleeping");
    expect(mood("ready", false, false)).toBe("Idle");
    expect(mood("input")).toBe("Idle");
    expect(sidebar).toContain("<BotMascotLead");
    expect(sidebar).toContain('topStatus?.mark === "working" && isBotThread(thread)');
    expect(timeline).toContain("<BotEmptyConversation");
  });

  it("seeds a bot's folder with rules, state and the compaction hooks", () => {
    const files = new Map(
      botSeedFiles({ name: "Mail Bot", today: "2026-11-13", threadId: "thread-1" }).map((file) => [
        file.relativePath,
        file.contents,
      ]),
    );
    const rules = files.get("CLAUDE.md") ?? "";
    expect(rules).toContain("# Mail Bot");
    expect(rules).toContain("freshSession: true");
    expect(rules).toContain(`reply with exactly \`${BOT_QUIET_REPLY}\``);
    expect(rules).toContain("## Job");
    // A fresh wake drops the chat, so the bot is told where its own conversation is.
    expect(rules).toContain("thread id `thread-1`");
    expect(rules).toContain("a wake writes STATE.md only");
    // Usage: slow schedules, tail reads, a bounded Log, cheap subagents, no self-scheduling wakes.
    expect(rules).toContain("never wake more often than every 15 minutes");
    expect(rules).toContain(
      "`afterPosition` set to `itemCount` minus 21 when `itemCount` is over 20",
    );
    expect(rules).toContain("Keep at most 30 lines");
    expect(rules).toContain('model: "haiku"');
    expect(rules).toContain("A wake never creates, changes or deletes scheduled tasks");
    expect(files.get("STATE.md")).toContain("- 2026-11-13: Created.");
    expect(files.get(".claude/compact-instructions.md")).toContain("NOT YET SAVED");
    const settings = JSON.parse(files.get(".claude/settings.json") ?? "{}") as {
      autoMemoryEnabled: boolean;
      autoCompactWindow: number;
      permissions: { deny: Array<string> };
      hooks: {
        UserPromptSubmit: Array<{ hooks: Array<{ command: string }> }>;
        PreCompact: Array<{ hooks: Array<{ command: string }> }>;
        SessionStart: Array<{ matcher: string; hooks: Array<{ command: string }> }>;
      };
    };
    expect(settings.autoMemoryEnabled).toBe(false);
    expect(settings.autoCompactWindow).toBe(150_000);
    expect(settings.permissions.deny).toContain("Edit(.claude/**)");
    expect(settings.hooks.UserPromptSubmit[0]?.hooks[0]?.command).toContain("date ");
    expect(settings.hooks.PreCompact[0]?.hooks[0]?.command).toContain("compact-instructions.md");
    expect(settings.hooks.SessionStart[0]?.matcher).toBe("startup|clear|compact");
    expect(settings.hooks.SessionStart[0]?.hooks[0]?.command).toContain("STATE.md");
    expect(settings.hooks.SessionStart[0]?.hooks[0]?.command).toContain("head -c 8000");
  });

  it("names a bot's folder from its name and thread, on the server's separator", () => {
    expect(botFolderName("Morning Mail!", "thread-ABCDEF12-3456")).toBe("morning-mail-ef123456");
    expect(botFolderName("邮件", "thread-ABCDEF12-3456")).toBe("ef123456");
    expect(botFolderPath("/home/me/.t3/scratch/", "mail-1")).toBe(
      "/home/me/.t3/scratch/bots/mail-1",
    );
    expect(botFolderPath("C:\\t3\\scratch", "mail-1")).toBe("C:\\t3\\scratch\\bots\\mail-1");
  });
});
