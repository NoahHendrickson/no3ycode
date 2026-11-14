/**
 * A bot's work in the sidebar — see `.fork/customizations.yaml#fork-bot-work-threads`. A thread a
 * bot launched carries `bot-work:<bot id>` (the server's orchestration-v2/forkBotWork) and lists in
 * the bot's Threads panel instead of the sidebar, unless pinned or its bot no longer lists.
 *
 * No imports from the sidebar here: Sidebar.logic depends on this module.
 */
import type { OrchestrationV2ThreadShell, ThreadId } from "@t3tools/contracts";

/** Must match the server's `FORK_BOT_WORK_TAG_PREFIX`. */
export const BOT_WORK_TAG_PREFIX = "bot-work:";

/** Same as `BOT_THREAD_TAG` (custom/bots/botThreads), which imports the sidebar. */
const BOT_TAG = "bot";

type TaggedShell = { readonly source: Pick<OrchestrationV2ThreadShell, "tags"> };

/** The id of the bot a thread works for, or null for every other thread. */
export function botWorkOwnerId(shell: Pick<OrchestrationV2ThreadShell, "tags">): ThreadId | null {
  const tag = shell.tags?.find((candidate) => candidate.startsWith(BOT_WORK_TAG_PREFIX));
  return tag === undefined ? null : (tag.slice(BOT_WORK_TAG_PREFIX.length) as ThreadId);
}

/** The bots the sidebar lists, as `environmentId:threadId`. One pass per roster. */
export function listedBotKeys(
  threads: ReadonlyArray<
    TaggedShell & {
      readonly environmentId: string;
      readonly id: string;
      readonly archivedAt: string | null;
    }
  >,
): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const thread of threads) {
    if (thread.archivedAt === null && thread.source.tags?.includes(BOT_TAG) === true) {
      keys.add(`${thread.environmentId}:${thread.id}`);
    }
  }
  return keys;
}

/** True for a bot's work the owner has not pinned, while its bot still lists. */
export function isBotWorkOffSidebar(
  thread: TaggedShell & {
    readonly environmentId: string;
    readonly pinnedAt?: string | null | undefined;
  },
  listedBots: ReadonlySet<string>,
): boolean {
  if (thread.pinnedAt != null) return false;
  const owner = botWorkOwnerId(thread.source);
  return owner !== null && listedBots.has(`${thread.environmentId}:${owner}`);
}

/** The thread with its bot, if it has one, so a one-thread roster check sees the bot too. */
export function withOwningBot<T extends TaggedShell & { readonly environmentId: string }>(
  thread: T,
  findThread: (key: string) => T | undefined,
): T[] {
  const owner = botWorkOwnerId(thread.source);
  const bot = owner === null ? undefined : findThread(`${thread.environmentId}:${owner}`);
  return bot === undefined ? [thread] : [thread, bot];
}

/** The row an open thread lights: its bot's card, for a bot's work the sidebar leaves out. */
export function botWorkRowThreadId<
  T extends TaggedShell & {
    readonly environmentId: string;
    readonly id: ThreadId;
    readonly archivedAt: string | null;
    readonly pinnedAt?: string | null | undefined;
  },
>(rowThreadId: ThreadId, environmentId: string, threads: ReadonlyArray<T>): ThreadId {
  const thread = threads.find(
    (candidate) => candidate.id === rowThreadId && candidate.environmentId === environmentId,
  );
  if (thread === undefined || thread.pinnedAt != null) return rowThreadId;
  const owner = botWorkOwnerId(thread.source);
  if (owner === null) return rowThreadId;
  const bot = threads.find(
    (candidate) =>
      candidate.id === owner &&
      candidate.environmentId === environmentId &&
      candidate.archivedAt === null &&
      candidate.source.tags?.includes(BOT_TAG) === true,
  );
  return bot?.id ?? rowThreadId;
}
