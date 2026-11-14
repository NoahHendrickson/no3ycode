/**
 * The thread tags that make a thread a bot, and its work — see `.fork/customizations.yaml#fork-bots`
 * and `#fork-bot-work-threads`. Shared so the server, the web client and provider-core's subagent
 * builder read one spelling.
 */

/** The tag that makes a thread a bot. */
export const FORK_BOT_THREAD_TAG = "bot";
/** A bot's mascot is a second tag, `mascot:<Shape>`. */
export const FORK_BOT_MASCOT_TAG_PREFIX = "mascot:";
/** A bot's work carries `bot-work:<bot thread id>`. */
export const FORK_BOT_WORK_TAG_PREFIX = "bot-work:";

export function isForkBotThread(tags: ReadonlyArray<string> | undefined): boolean {
  return tags?.includes(FORK_BOT_THREAD_TAG) === true;
}

/** The tags a subagent inherits from its parent: every one but a bot's identity, so a bot's
    subagent is never another bot. */
export function forkSubagentTags(
  tags: ReadonlyArray<string> | undefined,
): ReadonlyArray<string> | undefined {
  return tags?.filter(
    (tag) => tag !== FORK_BOT_THREAD_TAG && !tag.startsWith(FORK_BOT_MASCOT_TAG_PREFIX),
  );
}
