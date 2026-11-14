/** A thread's bot, for its Threads panel — see
    `.fork/customizations.yaml#fork-bot-work-threads`. */
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";

import { useQuietThreadShell } from "~/state/entities";

import { botThreadsPanelBotId } from "./botWork";
import { isBotThread, isListedBot } from "./botThreads";
import { useBotThreadsPanelStore } from "./botThreadsPanelStore";
import { threadParentOf } from "./botWorkRoster";

/** The bot whose Threads panel the thread shows, or null: a bot shows its own, a bot's launched
    thread or subagent shows its bot's while that bot lists. */
export function useBotThreadsPanelBot(ref: ScopedThreadRef | null): ScopedThreadRef | null {
  const shell = useQuietThreadShell(ref);
  const parentId = shell === null || isBotThread(shell.source) ? null : threadParentOf(shell);
  const parent = useQuietThreadShell(
    ref === null || parentId === null ? null : scopeThreadRef(ref.environmentId, parentId.threadId),
  );
  if (ref === null || shell === null) return null;
  const botId = botThreadsPanelBotId(
    shell,
    (threadId) => parent !== null && parent.id === threadId && isListedBot(parent),
  );
  if (botId === null) return null;
  return botId === shell.id ? ref : scopeThreadRef(ref.environmentId, botId);
}

/** Whether the bot's Threads panel is set open (a held panel still counts). */
export function useBotThreadsPanelOpen(botRef: ScopedThreadRef | null): boolean {
  return useBotThreadsPanelStore(
    (state) => botRef !== null && state.openByBotKey[scopedThreadKey(botRef)] === true,
  );
}
