/**
 * A Petal's work threads waiting on the owner — see `.fork/customizations.yaml#fork-bot-digest`.
 * Their questions and approvals show in the Petal's composer dock, so the owner answers there.
 */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";

import { botWorkOwnerId } from "./botWorkRoster";

type ChildShell = Pick<
  EnvironmentThreadShell,
  | "environmentId"
  | "id"
  | "archivedAt"
  | "hasPendingApprovals"
  | "hasPendingUserInput"
  | "pendingUserInputAt"
  | "updatedAt"
  | "source"
>;

/** The bot's own work (its `bot-work` tag, never a subagent, which the thread view already
    surfaces) that waits on a question or an approval, the longest-waiting first. */
export function waitingBotChildren<T extends ChildShell>(
  threads: ReadonlyArray<T>,
  bot: Pick<EnvironmentThreadShell, "environmentId" | "id">,
): { readonly asking: ReadonlyArray<T>; readonly approving: ReadonlyArray<T> } {
  const mine = threads.filter(
    (thread) =>
      thread.archivedAt === null &&
      thread.environmentId === bot.environmentId &&
      (thread.hasPendingUserInput || thread.hasPendingApprovals) &&
      botWorkOwnerId(thread.source) === bot.id,
  );
  const since = (thread: T) => thread.pendingUserInputAt ?? thread.updatedAt;
  return {
    asking: mine
      .filter((thread) => thread.hasPendingUserInput)
      .toSorted((left, right) => since(left).localeCompare(since(right))),
    approving: mine
      .filter((thread) => thread.hasPendingApprovals)
      .toSorted((left, right) => left.updatedAt.localeCompare(right.updatedAt)),
  };
}
