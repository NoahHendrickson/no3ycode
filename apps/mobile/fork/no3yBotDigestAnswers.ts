/**
 * Which of a Petal's digest asks its owner has answered, on iOS — the Mac's
 * useAnsweredBotDigestAsks on the mobile registry; see `.fork/customizations.yaml#fork-bot-digest`.
 */
import { useAtomValue } from "@effect/atom-react";
import { parseScopedThreadKey } from "@t3tools/client-runtime/environment";
import {
  answeredBotDigestAsks,
  type BotDigestQuote,
  type BotDigestRead,
  botDigestQuotes,
  botDigestRevision,
  nextBotDigestRead,
} from "@t3tools/client-runtime/fork-bot-digest";
import type { MessageId } from "@t3tools/contracts";
import { type AsyncResult, Atom } from "effect/reactivity";
import { useEffect, useState } from "react";

import { appAtomRegistry } from "../src/state/atom-registry";
import { environmentThreadDetails } from "../src/state/threads";

export interface No3yBotDigestConversation {
  readonly revision: string;
  readonly quotes: ReadonlyArray<BotDigestQuote>;
}

const sameQuotes = (left: ReadonlyArray<BotDigestQuote>, right: ReadonlyArray<BotDigestQuote>) =>
  left.length === right.length &&
  left.every((quote, index) => {
    const other = right[index]!;
    return (
      quote.messageId === other.messageId &&
      quote.settled === other.settled &&
      quote.asks.join("\n") === other.asks.join("\n")
    );
  });

// Kept while only assistant text streams, so the digest redraws when a run moves or a quoting
// owner message changes, never at stream rate.
const conversationAtom = Atom.family((key: string) => {
  const ref = parseScopedThreadKey(key);
  let previous: No3yBotDigestConversation | null = null;
  return Atom.make((get): No3yBotDigestConversation | null => {
    const thread = ref === null ? null : get(environmentThreadDetails.quietThreadAtom(ref));
    if (thread === null) {
      previous = null;
      return null;
    }
    const revision = botDigestRevision(thread.projection.runs);
    const quotes = botDigestQuotes(thread.projection);
    if (previous?.revision !== revision || !sameQuotes(previous.quotes, quotes)) {
      previous = { revision, quotes };
    }
    return previous;
  }).pipe(Atom.withLabel(`no3y-bot-digest-conversation:${key}`));
});
const NO_CONVERSATION = Atom.make<No3yBotDigestConversation | null>(null).pipe(
  Atom.withLabel("no3y-bot-digest-conversation:none"),
);

/** The open Petal's runs and quoting owner messages, or null until its conversation loads. */
export function useNo3yBotDigestConversation(
  botKey: string | null,
): No3yBotDigestConversation | null {
  return useAtomValue(botKey === null ? NO_CONVERSATION : conversationAtom(botKey));
}

// Shared rather than component state: a send that fails after its digest unmounted must still
// bring the ask back on the digest mounted since.
const pendingAnswersAtom = Atom.family((key: string) =>
  Atom.make<ReadonlyMap<MessageId, string>>(new Map()).pipe(
    Atom.keepAlive,
    Atom.withLabel(`no3y-bot-digest-pending:${key}`),
  ),
);

const unheldAnswers = (botKey: string, conversation: No3yBotDigestConversation) => {
  const held = new Set(conversation.quotes.map((quote) => quote.messageId));
  return [...appAtomRegistry.get(pendingAnswersAtom(botKey))].filter(([id]) => !held.has(id));
};

/** Marks `ask` answered by `messageId` until the conversation holds it. */
export function markNo3yBotDigestAnswer(
  botKey: string,
  messageId: MessageId,
  ask: string,
  conversation: No3yBotDigestConversation,
) {
  appAtomRegistry.set(
    pendingAnswersAtom(botKey),
    new Map([...unheldAnswers(botKey, conversation), [messageId, ask]]),
  );
}

/** Brings back the ask a failed send marked. */
export function clearNo3yBotDigestAnswer(botKey: string, messageId: MessageId) {
  const atom = pendingAnswersAtom(botKey);
  appAtomRegistry.set(
    atom,
    new Map([...appAtomRegistry.get(atom)].filter(([id]) => id !== messageId)),
  );
}

// Put away for this app session, by the ask as written: one the bot rewrites comes back.
const dismissedAtom = Atom.family((key: string) =>
  Atom.make<ReadonlyArray<string>>([]).pipe(
    Atom.keepAlive,
    Atom.withLabel(`no3y-bot-digest-dismissed:${key}`),
  ),
);

export function useNo3yBotDigestDismissed(botKey: string) {
  const atom = dismissedAtom(botKey);
  const dismissed = useAtomValue(atom);
  const set = (next: ReadonlyArray<string>) => appAtomRegistry.set(atom, next);
  return [dismissed, set] as const;
}

// Outlives the digest's mount, so coming back while a read is in flight still knows the cached
// digest predates the answers settled since.
const readByBot = new Map<string, BotDigestRead>();

/** The asks to keep out of the digest: answered, and not yet settled in the digest read in hand. */
export function useNo3yAnsweredBotDigestAsks(
  botKey: string,
  conversation: No3yBotDigestConversation,
  result: AsyncResult.AsyncResult<unknown, unknown>,
): ReadonlySet<string> {
  const pending = useAtomValue(pendingAnswersAtom(botKey));
  // Retired once the conversation holds the message, so its text decides from then on, even after
  // an edit drops the quote or the message pages out of the loaded window.
  useEffect(() => {
    const unheld = unheldAnswers(botKey, conversation);
    if (unheld.length !== pending.size)
      appAtomRegistry.set(pendingAnswersAtom(botKey), new Map(unheld));
  }, [botKey, conversation, pending]);
  const readAt = result._tag === "Success" ? result.timestamp : null;
  const [stored, setStored] = useState<BotDigestRead>(
    () =>
      readByBot.get(botKey) ?? {
        revision: conversation.revision,
        readAt,
        settled: new Set(
          conversation.quotes.filter((quote) => quote.settled).map((quote) => quote.messageId),
        ),
      },
  );
  const read = nextBotDigestRead(stored, {
    revision: conversation.revision,
    readAt,
    waiting: result.waiting,
    quotes: conversation.quotes,
  });
  if (read !== stored) {
    setStored(() => {
      readByBot.set(botKey, read);
      return read;
    });
  }
  return answeredBotDigestAsks(conversation.quotes, read, pending);
}
