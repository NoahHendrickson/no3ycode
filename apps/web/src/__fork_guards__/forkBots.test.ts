// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/README.md` §4b and `.fork/customizations.yaml#fork-bots`.
 * Bots stay out of the thread roster, unread follows the server's report, and the seeded folder
 * keeps its hooks.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { MessageId } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { describe, expect, it } from "vite-plus/test";

import {
  filterSidebarV2VisibleThreads,
  type SidebarThreadStatus,
} from "../components/Sidebar.logic";
import { createThreadNotificationGate } from "../components/ThreadNotificationCoordinator.logic";
import {
  BOT_MASCOT_MOODS,
  BOT_MASCOT_SHAPES,
  botMascotRows,
  botMascotSprite,
} from "../custom/bots/botMascotArt";
import { botMascotFromMenuId, botMascotMenuItem } from "../custom/bots/botMascotMenu";
import {
  botMascotMood,
  botMascotShape,
  botMascotTag,
  botMascotTagWrites,
  nextBotMascotShape,
} from "../custom/bots/botMascotTags";
import { botFailureSignature, createBotFailureAlerts } from "../custom/bots/botFailureAlerts";
import { botSeedFiles } from "../custom/bots/botSeedFiles";
import {
  BOT_QUIET_REPLY,
  BOT_THREAD_TAG,
  botFolderName,
  botFolderPath,
  botStatusLine,
  hasUnreadBotReport,
  isBotThread,
  isQuietBotCompletion,
  listSidebarBots,
} from "../custom/bots/botThreads";
import { sidebarV2CardKind } from "../custom/bots/SidebarV2BotCardBody";
import { makeThreadFixture } from "../test-fixtures";
import type { Thread } from "../types";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const sidebar = readSibling("../components/Sidebar.tsx");
const notifications = readSibling("../components/ThreadNotificationCoordinator.tsx");
const cardStatus = readSibling("../custom/sidebarV2CardStatus.ts");
const chatView = readSibling("../components/ChatView.tsx");
const timeline = readSibling("../components/chat/MessagesTimeline.tsx");
const detailsPanel = readSibling("../components/chat/ThreadDetailsPanel.tsx");
const createBot = readSibling("../custom/bots/useCreateBot.ts");

/** A bot whose shell carries `report` as its latest report, as the server fills it. */
function bot(
  id: string,
  overrides: Partial<Thread> = {},
  report?: { readonly text: string; readonly at?: string },
  extraTags: ReadonlyArray<string> = [],
): Thread {
  const thread = makeThreadFixture({ id: id as Thread["id"], ...overrides });
  return {
    ...thread,
    source: {
      ...thread.source,
      tags: [BOT_THREAD_TAG, ...extraTags],
      latestVisibleMessage:
        report === undefined
          ? null
          : {
              id: MessageId.make(`message:${id}`),
              role: "assistant",
              text: report.text,
              updatedAt:
                report.at === undefined ? thread.source.updatedAt : DateTime.makeUnsafe(report.at),
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
    expect(isBotThread(threads[0]!.source)).toBe(false);
  });

  it("reads unread off the server's report, the same on every device", () => {
    const mail = bot(
      "mail",
      {},
      { text: "Your rent is due Friday.", at: "2026-11-13T08:00:00.000Z" },
    );
    expect(hasUnreadBotReport(mail.source, "2026-11-13T07:00:00.000Z")).toBe(true);
    expect(hasUnreadBotReport(mail.source, "2026-11-13T08:30:00.000Z")).toBe(false);
    // Never opened reads as read, as for other threads; no report is never unread.
    expect(hasUnreadBotReport(mail.source, undefined)).toBe(false);
    expect(hasUnreadBotReport(bot("new").source, "2026-11-13T07:00:00.000Z")).toBe(false);
    expect(cardStatus).toContain("hasUnreadBotReport(thread.source, input.lastVisitedAt)");
    expect(notifications).toContain(
      "isBotThread(state.raw) && isQuietBotCompletion(state.raw, state.thread.latestRun)",
    );
  });

  it("notifies a wake that brought a report, even when it settles a step later", () => {
    const run = { requestedAt: "2026-11-13T09:00:00.000Z", startedAt: null };
    const news = bot("mail", {}, { text: "Rent is due", at: "2026-11-13T09:01:00.000Z" }).source;
    const stale = bot("mail", {}, { text: "Rent is due", at: "2026-11-13T08:01:00.000Z" }).source;
    expect(isQuietBotCompletion(news, run)).toBe(false);
    expect(isQuietBotCompletion(stale, run)).toBe(true);
    expect(isQuietBotCompletion(bot("new").source, run)).toBe(true);
    // Running, then completed with the new report while background work still runs, then settled.
    const notified: Array<string> = [];
    const gate = createThreadNotificationGate<string>((_key, kind) => notified.push(kind));
    const step = (settled: boolean, completedAt: number | null) => ({
      attention: null,
      settled,
      completedAt,
    });
    const quiet = isQuietBotCompletion(news, run);
    gate.observe("mail", undefined, step(false, null), { archived: false, quiet });
    gate.observe("mail", step(false, null), step(false, 1), { archived: false, quiet });
    gate.observe("mail", step(false, 1), step(true, 1), { archived: false, quiet });
    expect(notified).toEqual(["completion"]);
  });

  it("alerts once for a bot that keeps failing the same way", () => {
    expect(botFailureSignature("Token expired at 2026-11-13T08:00:00Z (req 1234567)")).toBe(
      botFailureSignature("token expired at 2026-11-14T08:15:00Z (req 7654321)"),
    );
    expect(botFailureSignature("HTTP 401")).not.toBe(botFailureSignature("HTTP 429"));
    const alerts = createBotFailureAlerts<string>();
    const notified: Array<string> = [];
    const gate = createThreadNotificationGate<string>((_key, kind) => notified.push(kind));
    let prior:
      | { attention: string | null; settled: boolean; completedAt: number | null }
      | undefined;
    const wake = (run: string, outcome: "failed" | "completed" | "working", error?: string) => {
      const next = {
        attention: alerts.attention("bot", {
          attention: outcome === "failed" ? `${run}:failed` : null,
          failed: outcome === "failed",
          succeeded: outcome === "completed",
          error: error ?? null,
        }),
        settled: outcome === "completed",
        completedAt: outcome === "working" ? null : Number(run),
      };
      gate.observe("bot", prior, next, { archived: false, quiet: true });
      prior = next;
    };
    wake("0", "working");
    wake("1", "failed", "Token expired at 2026-11-13T08:00:00Z");
    wake("2", "working");
    wake("2", "failed", "Token expired at 2026-11-13T08:15:00Z");
    expect(notified).toEqual(["input"]);
    wake("3", "failed", "HTTP 429 Too Many Requests");
    expect(notified).toEqual(["input", "input"]);
    wake("4", "completed");
    wake("5", "failed", "HTTP 429 Too Many Requests");
    expect(notified).toEqual(["input", "input", "input"]);
    expect(notifications).toContain("entry.botFailures.attention(rawThread.id, {");
  });

  it("says what a bot is doing, its unread news, or when it next checks", () => {
    const line = (
      thread: Thread,
      status: SidebarThreadStatus = "ready",
      input: { readonly isUnread?: boolean; readonly nextWakeAt?: string } = {},
    ) =>
      botStatusLine({
        shell: thread.source,
        status,
        isUnread: input.isUnread ?? false,
        nextWakeAt: input.nextWakeAt ?? null,
      });
    const report = bot("r", {}, { text: "## **Inbox**: 3 new from [Sam](https://x.y)\n\nMore" });
    const next = "2026-11-14T09:00:00Z";
    expect(line(report, "ready", { isUnread: true, nextWakeAt: next })).toEqual({
      text: "Inbox: 3 new from Sam",
    });
    expect(line(report, "ready", { nextWakeAt: next })).toEqual({ nextWakeAt: next });
    expect(line(report)).toEqual({ text: "Inbox: 3 new from Sam" });
    expect(line(report, "working")).toEqual({ text: "Working on it…" });
    expect(line(report, "approval")).toEqual({ text: "Needs your approval" });
    expect(line(report, "failed")).toEqual({ text: "Last run failed" });
    expect(line(bot("new"))).toEqual({ text: "Tell it what its job is" });
  });

  it("draws a bot card as one kind, chosen once per row", () => {
    expect(sidebarV2CardKind(bot("b").source, false)).toBe("bot");
    expect(sidebarV2CardKind(bot("b").source, true)).toBe("bot-compact");
    const plain = makeThreadFixture({ id: "plain" as Thread["id"] }).source;
    expect(sidebarV2CardKind(plain, false)).toBe("card");
    expect(sidebarV2CardKind(plain, true)).toBe("compact");
    expect(sidebar).toContain(
      "const cardKind = sidebarV2CardKind(thread.source, props.compact === true);",
    );
    expect(sidebar).toContain("<SidebarV2BotCardBody");
    // The avatar card is 44px, 6 + 16 + 2 + 14 + 6, so its offscreen size hint says so too.
    expect(sidebar).toContain("[contain-intrinsic-size:auto_44px]");
    expect(sidebar).toContain('workingMark={cardKind !== "bot" && cardKind !== "bot-compact"}');
    expect(sidebar).toContain("<BotMascotLead");
  });

  it("paints Bots above a collapsible Threads section, with the bots' own density", () => {
    expect(sidebar).toContain("<SidebarV2BotsRow");
    expect(sidebar).toContain('renderOneThreadRow(bot, "active", { compact: compactBots })');
    expect(sidebar).toContain("options.compact ??");
    expect(sidebar).not.toContain("createPortal");
    expect(sidebar).toContain('onToggleCollapsed={() => toggleListSectionCollapsed("threads")}');
    expect(sidebar).toContain("return threadsSectionCollapsed ? [] : items;");
    expect(chatView).toContain("isForkChatThread || isForkBotThread");
  });

  it("tags a new bot `bot` before its mascot", () => {
    expect(createBot).toContain("input: { threadId, tag: BOT_THREAD_TAG, tagged: true },");
    expect(createBot).toContain(
      "await run(threadEnvironment.delete, { environmentId, input: { threadId } });",
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
      // One CSS pixel per cell must fit the compact card's lead slot (22px wide).
      expect(idle.width).toBeLessThanOrEqual(22);
      expect(idle.height).toBeLessThanOrEqual(20);
    }
    const tagged = bot("tagged", {}, undefined, ["mascot:Sakura"]).source;
    expect(botMascotShape(tagged)).toBe("Sakura");
    expect(BOT_MASCOT_SHAPES).toContain(botMascotShape(bot("untagged").source));
    expect(botMascotShape(bot("untagged").source)).toBe(botMascotShape(bot("untagged").source));
    expect(nextBotMascotShape(["Classic", "Round"])).toBe("Willow");
    expect(botMascotTag("Sakura")).toBe("mascot:Sakura");
    // Changing a mascot sets the new tag, then clears every other one.
    expect(botMascotTagWrites(tagged, "Round")).toEqual([
      { tag: "mascot:Round", tagged: true },
      { tag: "mascot:Sakura", tagged: false },
    ]);
    expect(botMascotTagWrites(tagged, "Sakura")).toEqual([]);
    const menu = botMascotMenuItem(tagged, true);
    expect(menu.children.filter((item) => item.checked).map((item) => item.label)).toEqual([
      "Sakura",
    ]);
    expect(menu.children.map((item) => botMascotFromMenuId(item.id))).toEqual(BOT_MASCOT_SHAPES);
    expect(botMascotFromMenuId("rename")).toBeNull();
    expect(sidebar).toContain("setBotMascot(thread, mascot)");
    expect(detailsPanel).toContain("<BotMascotDetailsSection threadRef={activeThreadRef} />");
    const mood = (status: SidebarThreadStatus, isUnread = false, resting = true) =>
      botMascotMood({ status, isUnread, resting });
    expect(mood("working")).toBe("Thinking");
    expect(mood("failed", true)).toBe("Error");
    expect(mood("ready", true)).toBe("Happy");
    expect(mood("ready")).toBe("Sleeping");
    expect(mood("ready", false, false)).toBe("Idle");
    expect(mood("input")).toBe("Idle");
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
    // The rules are locked; the job the bot keeps lives in JOB.md, loaded from them.
    expect(rules).toContain("## Job\n\n@JOB.md");
    expect(files.get("JOB.md")).toContain("# Job");
    expect(rules).toContain("A message that starts with `Scheduled wake:` is a wake");
    // A fresh wake drops the chat, so the bot is told where its own conversation is.
    expect(rules).toContain("thread id `thread-1`");
    expect(rules).toContain("a wake writes STATE.md only");
    // Usage: slow schedules, tail reads, a bounded Log, cheap subagents, no self-scheduling wakes.
    expect(rules).toContain("refuses an interval under 15 minutes");
    expect(rules).toContain(
      "`afterPosition` set to `itemCount` minus 21 when `itemCount` is over 20",
    );
    expect(rules).toContain("Keep at most 30 lines");
    expect(rules).toContain('model: "haiku"');
    expect(rules).toContain("A wake never creates, changes or deletes scheduled tasks");
    expect(rules).toContain("A promise written only in STATE.md never happens");
    expect(rules).toContain("use a webhook schedule with `threadEvents`");
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
    expect(settings.permissions.deny).toEqual(["Edit(.claude/**)", "Edit(CLAUDE.md)"]);
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
