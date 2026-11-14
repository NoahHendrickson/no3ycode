/**
 * The thread a conversation's header leads back to — see
 * `.fork/customizations.yaml#fork-stage-header`: a subagent's parent (upstream's parent link), else
 * the bot a bot's work belongs to (fork-bot-work-threads), else none.
 */
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef, ThreadId } from "@t3tools/contracts";

import { useQuietThreadShell } from "~/state/entities";

import { threadParentOf } from "../bots/botWorkRoster";

/** The parent with its title. A subagent's parent not loaded yet keeps upstream's placeholder;
    a bot that is gone leads nowhere. */
export function useStageHeaderParent(
  ref: ScopedThreadRef | null,
): { readonly threadId: ThreadId; readonly title: string } | null {
  const shell = useQuietThreadShell(ref);
  const parent = shell === null ? null : threadParentOf(shell);
  const parentShell = useQuietThreadShell(
    ref === null || parent === null ? null : scopeThreadRef(ref.environmentId, parent.threadId),
  );
  if (parent === null) return null;
  if (parentShell === null) {
    return parent.kind === "subagent"
      ? { threadId: parent.threadId, title: "Parent thread" }
      : null;
  }
  return { threadId: parentShell.id, title: parentShell.title };
}
