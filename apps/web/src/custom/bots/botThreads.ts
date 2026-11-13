/**
 * Bots — see `.fork/customizations.yaml#fork-bots`. A bot is a No-project thread tagged `bot`
 * that runs in its own folder; the folder, not the transcript, holds what it knows.
 */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";

/** The server-side tag that makes a thread a bot. */
export const BOT_THREAD_TAG = "bot";

/** A second tag names the bot's mascot, e.g. `mascot:Sakura` (custom/bots/botMascots). */
export const BOT_THREAD_TAG_PREFIX_MASCOT = "mascot:";

/** Where bot folders live, relative to the No-project workspace root. */
export const BOT_FOLDERS_DIRECTORY = "bots";

/** What a bot replies when a wake found nothing worth saying. */
export const BOT_QUIET_REPLY = "Nothing to report.";

/** Structural, so the roster filter and its guard can pass any thread shape. */
export interface BotThreadFields {
  readonly source?:
    | {
        readonly tags?: ReadonlyArray<string> | undefined;
        readonly latestVisibleMessage?:
          | { readonly role: string; readonly text: string }
          | null
          | undefined;
      }
    | undefined;
}

export function isBotThread(thread: BotThreadFields): boolean {
  return thread.source?.tags?.includes(BOT_THREAD_TAG) === true;
}

/** A bot whose last word was the quiet reply: a wake that found nothing. It
    neither notifies nor marks the bot unread. Anything more than the bare
    reply counts as a report, so a bot that says too much is heard. */
export function isQuietBotReport(thread: BotThreadFields): boolean {
  if (!isBotThread(thread)) return false;
  const latest = thread.source?.latestVisibleMessage;
  if (latest == null || latest.role !== "assistant") return false;
  return /^nothing to report\.?$/i.test(latest.text.trim());
}

/** Bots listed in the sidebar's Bots section, oldest first so a bot keeps its place. */
export function listSidebarBots<
  T extends Pick<EnvironmentThreadShell, "archivedAt" | "createdAt"> & BotThreadFields,
>(threads: ReadonlyArray<T>): T[] {
  return threads
    .filter((thread) => thread.archivedAt === null && isBotThread(thread))
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
