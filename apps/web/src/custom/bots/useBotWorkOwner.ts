/** The bot a thread works for, for its header's way back — see
    `.fork/customizations.yaml#fork-bot-work-threads`. */
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef, ThreadId } from "@t3tools/contracts";

import { useQuietThreadShell } from "~/state/entities";

import { useBotThreadsPanelStore } from "./botThreadsPanelStore";
import { botWorkOwnerId } from "./botWorkRoster";

export function useBotWorkOwner(
  ref: ScopedThreadRef | null,
): { readonly threadId: ThreadId; readonly title: string } | null {
  const shell = useQuietThreadShell(ref);
  const ownerId = shell === null ? null : botWorkOwnerId(shell.source);
  const bot = useQuietThreadShell(
    ref === null || ownerId === null ? null : scopeThreadRef(ref.environmentId, ownerId),
  );
  return bot === null ? null : { threadId: bot.id, title: bot.title };
}

/** Whether the thread's Threads panel is set open (a held panel still counts). */
export function useBotThreadsPanelOpen(ref: ScopedThreadRef | null): boolean {
  return useBotThreadsPanelStore(
    (state) => ref !== null && state.openByThreadKey[scopedThreadKey(ref)] === true,
  );
}
