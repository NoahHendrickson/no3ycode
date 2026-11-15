/**
 * Giving a thread to a bot, and taking it back — see `.fork/customizations.yaml#fork-bot-crew`.
 * A thread is a bot's work while it carries `bot-work:<bot id>`; the owner moves it between bots
 * from its context menu, and the bot hears of it in its conversation.
 */
import type { OrchestrationV2ThreadShell, ThreadId } from "@t3tools/contracts";
import { FORK_BOT_WORK_TAG_PREFIX, isForkBotThread } from "@t3tools/shared/forkBotTags";

import { botWorkOwnerId } from "./botWorkRoster";

type CrewShell = Pick<OrchestrationV2ThreadShell, "tags" | "lineage">;

/** A thread a bot can take: a listed thread that is no bot itself. A subagent or side chat goes
    with its parent. */
export function canJoinBotWork(shell: CrewShell): boolean {
  return (
    !isForkBotThread(shell.tags) &&
    shell.lineage.relationshipToParent !== "subagent" &&
    shell.lineage.sideChat !== true
  );
}

/** The tag writes that make `botId` the thread's only bot, or no bot's for null: the new tag
    first, so the thread never lists in the sidebar between the writes. */
export function botWorkTagWrites(
  shell: Pick<OrchestrationV2ThreadShell, "tags">,
  botId: ThreadId | null,
): ReadonlyArray<{ readonly tag: string; readonly tagged: boolean }> {
  const next = botId === null ? null : `${FORK_BOT_WORK_TAG_PREFIX}${botId}`;
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
const MENU_NONE = `${MENU_PREFIX}none` as const;
type BotCrewMenuId = "bot-crew" | `${typeof MENU_PREFIX}${string}`;

/** The thread menu's Petal submenu: the listed bots, ticked at the one the thread works for, and
    None to take it back. */
export function botCrewMenuItem(
  shell: Pick<OrchestrationV2ThreadShell, "tags">,
  bots: ReadonlyArray<{ readonly id: ThreadId; readonly title: string }>,
  canOperate: boolean,
) {
  const current = botWorkOwnerId(shell);
  return {
    id: "bot-crew" as const,
    label: "Petal",
    disabled: !canOperate,
    children: [
      ...bots.map((bot) => ({
        id: `${MENU_PREFIX}${bot.id}` as BotCrewMenuId,
        label: bot.title,
        checked: bot.id === current,
      })),
      { id: MENU_NONE as BotCrewMenuId, label: "None", checked: current === null },
    ],
  };
}

export function isBotCrewMenuId(id: string): id is BotCrewMenuId {
  return id === "bot-crew" || id.startsWith(MENU_PREFIX);
}

/** The bot a picked item names: a bot's id, null for None, undefined for the submenu itself. */
export function botFromCrewMenuId(id: string): ThreadId | null | undefined {
  if (id === MENU_NONE) return null;
  return id.startsWith(MENU_PREFIX) ? (id.slice(MENU_PREFIX.length) as ThreadId) : undefined;
}
