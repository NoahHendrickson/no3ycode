/** A thread's bot, for its Threads panel — see
    `.fork/customizations.yaml#fork-bot-work-threads`. */
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef, ThreadId } from "@t3tools/contracts";

import { useQuietThreadShell } from "~/state/entities";

import { botThreadsPanelBotId } from "./botWork";
import { isBotThread } from "./botThreads";
import { useBotThreadsPanelStore } from "./botThreadsPanelStore";
/** The bot whose Threads panel the thread shows, or null: a bot shows its own, a bot's launched
    thread or subagent shows its bot's. */
export function useBotThreadsPanelBot(ref: ScopedThreadRef | null): ScopedThreadRef | null {
  const shell = useQuietThreadShell(ref);
  const candidateId =
    shell === null || isBotThread(shell.source) ? null : botThreadsPanelBotId(shell, () => true);
  const candidate = useQuietThreadShell(
    ref === null || candidateId === null
      ? null
      : scopeThreadRef(ref.environmentId, candidateId as ThreadId),
  );
  if (ref === null || shell === null) return null;
  const botId = botThreadsPanelBotId(
    shell,
    // An archived bot's threads are ordinary threads again, in the sidebar and here.
    (threadId) =>
      candidate !== null &&
      candidate.id === threadId &&
      candidate.archivedAt === null &&
      isBotThread(candidate.source),
  );
  if (botId === null) return null;
  return botId === shell.id ? ref : scopeThreadRef(ref.environmentId, botId as ThreadId);
}

/** Whether the bot's Threads panel is set open (a held panel still counts). */
export function useBotThreadsPanelOpen(botRef: ScopedThreadRef | null): boolean {
  return useBotThreadsPanelStore(
    (state) => botRef !== null && state.openByBotKey[scopedThreadKey(botRef)] === true,
  );
}
