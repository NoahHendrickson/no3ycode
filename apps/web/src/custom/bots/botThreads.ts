/**
 * Bots — see `.fork/customizations.yaml#fork-bots`. A bot is a No-project thread tagged `bot`
 * that runs in its own folder; the folder, not the transcript, holds what it knows.
 */
import type { OrchestrationV2ThreadShell } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";

import type { SidebarThreadStatus } from "~/components/Sidebar.logic";

/** The server-side tag that makes a thread a bot (the server's `FORK_BOT_THREAD_TAG`). */
export const BOT_THREAD_TAG = "bot";

/** A second tag names the bot's mascot, e.g. `mascot:Sakura` (custom/bots/botMascotTags). */
export const BOT_THREAD_TAG_PREFIX_MASCOT = "mascot:";

/** Where bot folders live, relative to the No-project workspace root. */
export const BOT_FOLDERS_DIRECTORY = "bots";

/** What a bot replies when a wake found nothing; the server's report skips it. */
export const BOT_QUIET_REPLY = "Nothing to report.";

/** The part of a thread shell bots read. Its `latestVisibleMessage` is the bot's latest report:
    the server fills it for bots only, skipping quiet wakes (orchestration-v2/forkBotReport). */
export type BotShell = Pick<OrchestrationV2ThreadShell, "tags" | "latestVisibleMessage">;

export function isBotThread(shell: Pick<BotShell, "tags">): boolean {
  return shell.tags?.includes(BOT_THREAD_TAG) === true;
}

/** A bot the sidebar lists: an archived bot's work is ordinary threads again, everywhere. */
export function isListedBot(thread: {
  readonly archivedAt: string | null;
  readonly source: Pick<BotShell, "tags">;
}): boolean {
  return thread.archivedAt === null && isBotThread(thread.source);
}

/** Whether a bot's latest report arrived after the thread was last opened. Server clock on both
    sides, so every device agrees. Never opened reads as read, like other threads. */
export function hasUnreadBotReport(shell: BotShell, lastVisitedAt: string | undefined): boolean {
  const report = shell.latestVisibleMessage;
  if (report === null || report === undefined || lastVisitedAt === undefined) return false;
  const visitedAt = Date.parse(lastVisitedAt);
  return Number.isNaN(visitedAt) || DateTime.toEpochMillis(report.updatedAt) > visitedAt;
}

/** Whether a bot's latest run brought no new report: its report predates the run, or it has
    none. Stateless, so a completion that becomes eligible later (background work still
    settling) is judged the same as when the run ended. */
export function isQuietBotCompletion(
  shell: BotShell,
  latestRun: { readonly requestedAt: string | null; readonly startedAt: string | null } | null,
): boolean {
  const report = shell.latestVisibleMessage;
  if (report === null || report === undefined) return true;
  const runAt = Date.parse(latestRun?.requestedAt ?? latestRun?.startedAt ?? "");
  return !Number.isNaN(runAt) && DateTime.toEpochMillis(report.updatedAt) < runAt;
}

/** Bots listed in the sidebar's Bots section, oldest first so a bot keeps its place. */
export function listSidebarBots<
  T extends {
    readonly archivedAt: string | null;
    readonly createdAt: string;
    readonly source: Pick<BotShell, "tags">;
  },
>(threads: ReadonlyArray<T>): T[] {
  return threads
    .filter((thread) => thread.archivedAt === null && isBotThread(thread.source))
    .toSorted((left, right) => left.createdAt.localeCompare(right.createdAt));
}

/** A folder name from the bot's name, made unique by a slice of its thread id. */
export function botFolderName(name: string, threadId: string): string {
  const words = name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, 5)
    .join("-")
    .slice(0, 40)
    .replace(/-+$/, "");
  const id = threadId
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(-8);
  return [words, id].filter(Boolean).join("-");
}

/** Joined with the root's own separator: the path is the server's, not the browser's. */
export function botFolderPath(scratchWorkspaceRoot: string, folderName: string): string {
  const separator = scratchWorkspaceRoot.includes("\\") ? "\\" : "/";
  const root = scratchWorkspaceRoot.replace(/[\\/]+$/, "");
  return [root, BOT_FOLDERS_DIRECTORY, folderName].join(separator);
}

/** A bot card's second line: what it is doing, did last, or does next. Never model or branch. */
export type BotStatusLine = { readonly text: string } | { readonly nextWakeAt: string };

/** The first line of a message as plain words: markdown marks and link targets dropped. */
function botMessageSummary(text: string): string {
  const line =
    text
      .split("\n")
      .map((candidate) => candidate.trim())
      .find((candidate) => candidate !== "" && !/^(```|---|\*\*\*)/.test(candidate)) ?? "";
  return line
    .replace(/^(#{1,6}|[-*+]|\d+\.|>)\s+/, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|`)/g, "")
    .trim();
}

/** An unread report is the news; once it is read, when the bot next checks. */
export function botStatusLine(input: {
  readonly shell: BotShell;
  readonly status: SidebarThreadStatus;
  readonly isUnread: boolean;
  readonly nextWakeAt: string | null;
}): BotStatusLine {
  switch (input.status) {
    case "working":
    case "preparing":
      return { text: "Working on it…" };
    case "approval":
      return { text: "Needs your approval" };
    case "input":
    case "request":
      return { text: "Waiting for your reply" };
    case "failed":
      return { text: "Last run failed" };
    case "limited":
      return { text: "Hit a usage limit" };
    case "waiting":
    case "ready":
      break;
  }
  const report = input.shell.latestVisibleMessage;
  const summary = report == null ? "" : botMessageSummary(report.text);
  if (summary !== "" && (input.isUnread || input.nextWakeAt === null)) return { text: summary };
  if (input.nextWakeAt !== null) return { nextWakeAt: input.nextWakeAt };
  return { text: "Tell it what its job is" };
}
