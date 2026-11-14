/**
 * The thread a conversation's header leads back to — see
 * `.fork/customizations.yaml#fork-stage-header`: a subagent's parent (upstream's parent link), else
 * the bot a bot's work belongs to (fork-bot-work-threads), else none.
 */
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { ScopedThreadRef, ThreadId } from "@t3tools/contracts";

import { useQuietThreadShell } from "~/state/entities";

import { botWorkOwnerId } from "../bots/botWorkRoster";

export interface StageHeaderParent {
  readonly threadId: ThreadId;
  readonly kind: "subagent" | "bot";
}

export function stageHeaderParent(
  thread: Pick<EnvironmentThreadShell, "lineage"> & {
    readonly source: Pick<EnvironmentThreadShell["source"], "tags">;
  },
): StageHeaderParent | null {
  const { lineage } = thread;
  if (lineage.relationshipToParent === "subagent" && lineage.parentThreadId !== null) {
    return { threadId: lineage.parentThreadId, kind: "subagent" };
  }
  const bot = botWorkOwnerId(thread.source);
  return bot === null ? null : { threadId: bot, kind: "bot" };
}

/** The parent with its title. A subagent's parent not loaded yet keeps upstream's placeholder;
    a bot that is gone leads nowhere. */
export function useStageHeaderParent(
  ref: ScopedThreadRef | null,
): { readonly threadId: ThreadId; readonly title: string } | null {
  const shell = useQuietThreadShell(ref);
  const parent = shell === null ? null : stageHeaderParent(shell);
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
