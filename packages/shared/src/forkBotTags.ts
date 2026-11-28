/**
 * The thread tags that make a thread a bot, and its work — see `.fork/customizations.yaml#fork-bots`
 * and `#fork-bot-work-threads`. Shared so the server, the web client and provider-core's subagent
 * builder read one spelling.
 */
import { isListedThreadLineage, type OrchestrationV2AppThreadLineage } from "@t3tools/contracts";

/** The tag that makes a thread a bot. */
export const FORK_BOT_THREAD_TAG = "bot";
/** A bot's mascot is a second tag, `mascot:<Shape>`. */
export const FORK_BOT_MASCOT_TAG_PREFIX = "mascot:";
/** A bot's work carries `bot-work:<bot thread id>`. */
export const FORK_BOT_WORK_TAG_PREFIX = "bot-work:";
/** The rules file in a bot's folder that every thread it launches carries. */
export const FORK_BOT_CREW_FILE = "CREW.md";

/** The tag that makes a thread `botId`'s work. */
export function forkBotWorkTag(botId: string): string {
  return `${FORK_BOT_WORK_TAG_PREFIX}${botId}`;
}

/** The id of the bot whose work `tags` mark, or null. */
export function forkBotWorkOwner(tags: ReadonlyArray<string> | undefined): string | null {
  const tag = tags?.find((candidate) => candidate.startsWith(FORK_BOT_WORK_TAG_PREFIX));
  return tag === undefined ? null : tag.slice(FORK_BOT_WORK_TAG_PREFIX.length);
}

export function isForkBotThread(tags: ReadonlyArray<string> | undefined): boolean {
  return tags?.includes(FORK_BOT_THREAD_TAG) === true;
}

/** The tag that makes a thread a coordinator — see `.fork/customizations.yaml#fork-coordinator-threads`.
    Here, beside the bot tags, so the server words its notices to one by the same spelling. */
export const FORK_COORDINATOR_TAG = "coordinator";

/** The one definition of a coordinator: tagged, a listed top-level thread, and no bot or bot's
    work, which keep their own rules. Side chats, and subagents made before forkSubagentTags
    dropped the tag, still carry it, hence the lineage. */
export function isForkCoordinatorThread(thread: {
  readonly tags?: ReadonlyArray<string> | undefined;
  readonly lineage: OrchestrationV2AppThreadLineage;
}): boolean {
  return (
    thread.tags?.includes(FORK_COORDINATOR_TAG) === true &&
    !isForkBotThread(thread.tags) &&
    forkBotWorkOwner(thread.tags) === null &&
    isListedThreadLineage(thread.lineage)
  );
}

/** The tags a subagent inherits from its parent: every one but a bot's identity and the
    coordinator switch, so a bot's subagent is never another bot, nor a coordinator's another
    coordinator. */
export function forkSubagentTags(
  tags: ReadonlyArray<string> | undefined,
): ReadonlyArray<string> | undefined {
  return tags?.filter(
    (tag) =>
      tag !== FORK_BOT_THREAD_TAG &&
      tag !== FORK_COORDINATOR_TAG &&
      !tag.startsWith(FORK_BOT_MASCOT_TAG_PREFIX),
  );
}

/** The message id prefix of the server's notice of a delegated child's question
    (DelegatedTaskQuestionReactor): then the parent's thread id, a colon, the child's request id. */
export const FORK_DELEGATED_QUESTION_MESSAGE_PREFIX = "message:delegated-task-question:";
/** The thread id prefix of a delegate_task child (provider-core IdAllocator delegatedTaskThread). */
export const FORK_DELEGATED_TASK_THREAD_PREFIX = "thread:delegated-task:";

/** A delegate_task child in a checkout other than its parent's: its work is its own, so it never
    settles with its parent, even after the parent moves (a native subagent always does). The
    settlement store's getSettlementCandidates asks the same question in SQL. */
export function isForkOwnCheckoutDelegate(
  thread: { readonly id: string; readonly worktreePath: string | null },
  parent: { readonly worktreePath: string | null },
): boolean {
  return (
    thread.id.startsWith(FORK_DELEGATED_TASK_THREAD_PREFIX) &&
    thread.worktreePath !== parent.worktreePath
  );
}

/** What a bot replies when a wake found nothing. */
export const FORK_BOT_QUIET_REPLY = "Nothing to report.";
const quietReply = FORK_BOT_QUIET_REPLY.toLowerCase();
/** The quiet reply lowercased, with and without its full stop: the forms a reply is compared in. */
export const FORK_BOT_QUIET_REPLIES: ReadonlyArray<string> = [
  quietReply.replace(/\.$/, ""),
  quietReply,
];

/** Whether a bot's reply is the quiet one, ignoring case. Trims only what the server's report
    query trims (space, tab, CR, LF), so both sides agree on every reply. */
export function isForkBotQuietReply(text: string): boolean {
  return FORK_BOT_QUIET_REPLIES.includes(
    text.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, "").toLowerCase(),
  );
}
