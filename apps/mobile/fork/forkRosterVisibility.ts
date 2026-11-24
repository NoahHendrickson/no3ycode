/** Mobile copy of web's roster visibility predicates — guarded for parity in `no3yMobileRedesign.test.ts`. */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { isShownUnderParent } from "@t3tools/client-runtime/state/threads";
import { EnvironmentId, ThreadId, type OrchestrationV2ThreadShell } from "@t3tools/contracts";
import { forkBotWorkOwner, isForkBotThread } from "@t3tools/shared/forkBotTags";

/** Optional so roster callers that never carry a shell still type-check. */
export interface ScheduledRunRosterFields {
  readonly pinnedAt?: string | null | undefined;
  readonly source?: Pick<OrchestrationV2ThreadShell, "scheduledTaskId"> | undefined;
}

/** True for a thread an automation launched that the user has not pinned. */
export function isScheduledRunOffSidebar(thread: ScheduledRunRosterFields): boolean {
  return thread.source?.scheduledTaskId !== undefined && thread.pinnedAt == null;
}

export interface BotRosterThreadFields {
  readonly environmentId: string;
  readonly id: string;
  readonly archivedAt: string | null;
  readonly pinnedAt?: string | null | undefined;
  readonly source?: Pick<OrchestrationV2ThreadShell, "tags"> | undefined;
}

/** Live, unarchived bot threads keyed as `environmentId:threadId`. */
export function listedBotKeys(threads: ReadonlyArray<BotRosterThreadFields>): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const thread of threads) {
    if (thread.archivedAt === null && isForkBotThread(thread.source?.tags)) {
      keys.add(`${thread.environmentId}:${thread.id}`);
    }
  }
  return keys;
}

/** True for a bot's work the owner has not pinned, while its bot is still live and unarchived. */
export function isBotWorkOffSidebar(
  thread: Pick<BotRosterThreadFields, "environmentId" | "pinnedAt" | "source">,
  listedBots: ReadonlySet<string>,
): boolean {
  if (thread.pinnedAt != null) return false;
  const owner = forkBotWorkOwner(thread.source?.tags);
  return owner !== null && listedBots.has(`${thread.environmentId}:${owner}`);
}

export interface ForkRosterThread extends ScheduledRunRosterFields, BotRosterThreadFields {
  readonly lineage: EnvironmentThreadShell["lineage"];
  readonly source?: Pick<OrchestrationV2ThreadShell, "scheduledTaskId" | "tags"> | undefined;
}

/** Excludes archived, subagent/delegated, unpinned automation-run, bot, and live bot-work threads. */
export function filterForkRosterVisibleThreads<T extends ForkRosterThread>(
  threads: readonly T[],
  options?: {
    readonly delegatedUnderParent?: ReadonlySet<string>;
    readonly excludeBots?: boolean;
  },
): T[] {
  const delegatedUnderParent = options?.delegatedUnderParent ?? new Set<string>();
  const excludeBots = options?.excludeBots ?? true;
  const listedBots = listedBotKeys(threads);
  return threads.filter(
    (thread) =>
      thread.archivedAt === null &&
      !isShownUnderParent(
        {
          environmentId: EnvironmentId.make(thread.environmentId),
          threadId: ThreadId.make(thread.id),
        },
        thread.lineage,
        delegatedUnderParent,
      ) &&
      !isScheduledRunOffSidebar(thread) &&
      (!excludeBots || !isForkBotThread(thread.source?.tags)) &&
      !isBotWorkOffSidebar(thread, listedBots),
  );
}
