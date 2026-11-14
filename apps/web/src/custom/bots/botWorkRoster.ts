/**
 * A bot's work in the sidebar — see `.fork/customizations.yaml#fork-bot-work-threads`. A thread a
 * bot launched carries `bot-work:<bot id>` (the server's orchestration-v2/forkBotWork) and lists in
 * the bot's Threads panel instead of the sidebar, unless pinned or its bot no longer lists.
 *
 * No runtime imports from the sidebar here: Sidebar.logic depends on this module.
 */
import type { OrchestrationV2ThreadShell, ThreadId } from "@t3tools/contracts";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { FORK_BOT_WORK_TAG_PREFIX } from "@t3tools/shared/forkBotTags";

import { isListedBot } from "./botThreads";

type TaggedShell = { readonly source: Pick<OrchestrationV2ThreadShell, "tags"> };

/** The id of the bot a thread works for, or null for every other thread. */
export function botWorkOwnerId(shell: Pick<OrchestrationV2ThreadShell, "tags">): ThreadId | null {
  const tag = shell.tags?.find((candidate) => candidate.startsWith(FORK_BOT_WORK_TAG_PREFIX));
  return tag === undefined ? null : (tag.slice(FORK_BOT_WORK_TAG_PREFIX.length) as ThreadId);
}

/** The thread a thread belongs under: a subagent's parent, else the bot a bot's work names. The
    one answer for the header's back link and for whose Threads panel a thread shows. */
export function threadParentOf(
  thread: Pick<EnvironmentThreadShell, "lineage"> & {
    readonly source: Pick<EnvironmentThreadShell["source"], "tags">;
  },
): { readonly threadId: ThreadId; readonly kind: "subagent" | "bot" } | null {
  const { lineage } = thread;
  if (lineage.relationshipToParent === "subagent" && lineage.parentThreadId !== null) {
    return { threadId: lineage.parentThreadId, kind: "subagent" };
  }
  const bot = botWorkOwnerId(thread.source);
  return bot === null ? null : { threadId: bot, kind: "bot" };
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
    if (isListedBot(thread)) {
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
      candidate.id === owner && candidate.environmentId === environmentId && isListedBot(candidate),
  );
  return bot?.id ?? rowThreadId;
}
