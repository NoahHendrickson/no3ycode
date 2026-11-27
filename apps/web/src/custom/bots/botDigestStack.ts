/**
 * What a Petal's digest pages through — see `.fork/customizations.yaml#fork-bot-digest`: its work
 * threads waiting on the owner (approvals, then questions), then its digest's open asks, one card
 * at a time.
 */
import type { BotDigestItem } from "@t3tools/client-runtime/fork-bot-digest";
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
  | "createdAt"
  | "updatedAt"
  | "source"
>;

/** The bot's own work (its `bot-work` tag, never a subagent, which the thread view already
    surfaces) that waits on a question, longest-waiting first, or on an approval, oldest thread
    first (the shell keeps no time for a pending approval). */
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
      .toSorted((left, right) => left.createdAt.localeCompare(right.createdAt)),
  };
}

export type BotDigestEntry<T> =
  | { readonly kind: "approval" | "question"; readonly key: string; readonly child: T }
  | { readonly kind: "ask"; readonly key: string; readonly item: BotDigestItem };

/** Every card, in order, and how many of the digest's open asks are put away. An ask that sends
    the owner to a work thread's question (`questionOf`) leaves: the question is its own card. */
export function deriveBotDigestStack<T extends ChildShell>(input: {
  readonly threads: ReadonlyArray<T>;
  readonly bot: Pick<EnvironmentThreadShell, "environmentId" | "id">;
  readonly asks: ReadonlyArray<BotDigestItem>;
  readonly answered: ReadonlySet<string>;
  readonly dismissed: ReadonlyArray<string>;
  readonly questionOf: (item: BotDigestItem) => T | undefined;
}): { readonly entries: ReadonlyArray<BotDigestEntry<T>>; readonly hiddenCount: number } {
  const { asking, approving } = waitingBotChildren(input.threads, input.bot);
  const open = input.asks.filter((item) => {
    if (input.answered.has(item.source)) return false;
    const question = input.questionOf(item);
    return question === undefined || !asking.includes(question);
  });
  const shown = open.filter((item) => !input.dismissed.includes(item.source));
  const childKey = (kind: string, child: T) => `${kind}:${child.environmentId}:${child.id}`;
  return {
    entries: [
      ...approving.map((child) => ({
        kind: "approval" as const,
        key: childKey("approval", child),
        child,
      })),
      ...asking.map((child) => ({
        kind: "question" as const,
        key: childKey("question", child),
        child,
      })),
      ...shown.map((item) => ({ kind: "ask" as const, key: `ask:${item.source}`, item })),
    ],
    hiddenCount: open.length - shown.length,
  };
}

/** Where the owner last paged: the card they chose while it lasts, so a request arriving ahead
    of it never swaps the card under their cursor; once it goes, the place it held. */
export interface BotDigestPage {
  readonly key: string | null;
  readonly index: number;
}

export function botDigestPageAt(
  entries: ReadonlyArray<{ readonly key: string }>,
  page: BotDigestPage,
): number {
  const kept = page.key === null ? -1 : entries.findIndex((entry) => entry.key === page.key);
  return kept >= 0 ? kept : Math.min(page.index, Math.max(0, entries.length - 1));
}
