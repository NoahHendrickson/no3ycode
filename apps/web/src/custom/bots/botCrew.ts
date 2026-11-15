/**
 * Giving a thread to a bot, and taking it back — see `.fork/customizations.yaml#fork-bot-crew`.
 * A thread is a bot's work while it carries `bot-work:<bot id>`; the owner moves it between bots
 * from its context menu, and the bot hears of it in its conversation.
 */
import {
  type OrchestrationV2ThreadShell,
  ThreadId,
  isListedThreadLineage,
} from "@t3tools/contracts";
import {
  FORK_BOT_WORK_TAG_PREFIX,
  forkBotWorkTag,
  isForkBotThread,
} from "@t3tools/shared/forkBotTags";

import { botWorkOwnerId } from "./botWorkRoster";

type CrewShell = Pick<OrchestrationV2ThreadShell, "tags" | "lineage">;

/** A thread a bot can take: a listed thread that is no bot itself. A subagent or side chat goes
    with its parent. */
export function canJoinBotWork(shell: CrewShell): boolean {
  return !isForkBotThread(shell.tags) && isListedThreadLineage(shell.lineage);
}

/** The tag writes that make `botId` the thread's only bot, or no bot's for null: the new tag
    first, so the thread never lists in the sidebar between the writes. */
export function botWorkTagWrites(
  shell: Pick<OrchestrationV2ThreadShell, "tags">,
  botId: ThreadId | null,
): ReadonlyArray<{ readonly tag: string; readonly tagged: boolean }> {
  const next = botId === null ? null : forkBotWorkTag(botId);
  const tags = shell.tags ?? [];
  return [
    ...(next === null || tags.includes(next) ? [] : [{ tag: next, tagged: true }]),
    ...tags
      .filter((tag) => tag.startsWith(FORK_BOT_WORK_TAG_PREFIX) && tag !== next)
      .map((tag) => ({ tag, tagged: false })),
  ];
}

/** What the owner tells a bot when it gains or loses a thread, so its STATE.md keeps up. */
export function botCrewMessage(
  thread: { readonly id: string; readonly title: string },
  change: "given" | "taken",
): string {
  return change === "given"
    ? `I'm giving you my thread "${thread.title}" (${thread.id}). Read it with t3_thread_read, add it to Open in STATE.md and DIGEST.md, and keep track of it like a thread you started. It will report to you from now on. Don't reply unless something in it needs me.`
    : `I took my thread "${thread.title}" (${thread.id}) back. Take it off Open in STATE.md and DIGEST.md and stop tracking it. Don't reply.`;
}

const MENU_PREFIX = "bot-crew:";
type BotCrewMenuId = "bot-crew" | `${typeof MENU_PREFIX}${string}`;
const NONE = "none";

function crewMenuId(target: ThreadId | typeof NONE): BotCrewMenuId {
  return `${MENU_PREFIX}${target}`;
}

/** The thread menu's Petal submenu, as a spreadable list: the listed bots, ticked at the one the
    thread works for, and None to take it back. Empty where the thread cannot join a bot's work
    or no bot lists. */
export function botCrewMenuItems(
  shell: CrewShell,
  bots: ReadonlyArray<{ readonly id: ThreadId; readonly title: string }>,
  canOperate: boolean,
) {
  if (bots.length === 0 || !canJoinBotWork(shell)) return [];
  const current = botWorkOwnerId(shell);
  return [
    {
      id: "bot-crew" as BotCrewMenuId,
      label: "Petal",
      disabled: !canOperate,
      children: [
        ...bots.map((bot) => ({
          id: crewMenuId(bot.id),
          label: bot.title,
          checked: bot.id === current,
        })),
        { id: crewMenuId(NONE), label: "None", checked: current === null },
      ],
    },
  ];
}

export function isBotCrewMenuId(id: string): id is BotCrewMenuId {
  return id === "bot-crew" || id.startsWith(MENU_PREFIX);
}

/** The bot a picked item names: a bot's id, null for None, undefined for the submenu itself. */
export function botFromCrewMenuId(id: string): ThreadId | null | undefined {
  if (!id.startsWith(MENU_PREFIX)) return undefined;
  const target = id.slice(MENU_PREFIX.length);
  return target === NONE ? null : ThreadId.make(target);
}
