/**
 * Which of a bot's digest asks its owner has answered — see `.fork/customizations.yaml#fork-bot-digest`.
 */
import { useAtomValue } from "@effect/atom-react";
import { parseScopedThreadKey } from "@t3tools/client-runtime/environment";
import type { MessageId } from "@t3tools/contracts";
import { AsyncResult, Atom } from "effect/reactivity";
import { useState } from "react";

import { appAtomRegistry } from "~/rpc/atomRegistry";
import { environmentThreadDetails } from "~/state/threads";

import {
  answeredBotDigestAsks,
  type BotDigestQuote,
  type BotDigestRead,
  botDigestQuotes,
  botDigestRevision,
  nextBotDigestRead,
} from "./botDigestSections";

export interface BotDigestConversation {
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

// Kept while only assistant text streams, so the digest redraws when a run moves or an owner
// message that quotes an ask comes, goes or changes, never at stream rate.
const conversationAtom = Atom.family((key: string) => {
  const ref = parseScopedThreadKey(key);
  let previous: BotDigestConversation | null = null;
  return Atom.make((get): BotDigestConversation | null => {
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
  }).pipe(Atom.withLabel(`fork-bot-digest-conversation:${key}`));
});
const NO_CONVERSATION = Atom.make<BotDigestConversation | null>(null).pipe(
  Atom.withLabel("fork-bot-digest-conversation:none"),
);

/** The open bot's runs and quoting owner messages, or null until its conversation loads. */
export function useBotDigestConversation(botKey: string | null): BotDigestConversation | null {
  return useAtomValue(botKey === null ? NO_CONVERSATION : conversationAtom(botKey));
}

// Shared rather than component state: a send that fails after its digest unmounted must still
// bring the ask back on the digest mounted since.
const pendingAnswersAtom = Atom.family((key: string) =>
  Atom.make<ReadonlyMap<MessageId, string>>(new Map()).pipe(
    Atom.keepAlive,
    Atom.withLabel(`fork-bot-digest-pending:${key}`),
  ),
);

/** Marks `ask` answered by `messageId` until the conversation holds it, dropping the marks of
    answers it already holds. */
export function markBotDigestAnswer(
  botKey: string,
  messageId: MessageId,
  ask: string,
  conversation: BotDigestConversation,
) {
  const atom = pendingAnswersAtom(botKey);
  const held = new Set(conversation.quotes.map((quote) => quote.messageId));
  const kept = [...appAtomRegistry.get(atom)].filter(([id]) => !held.has(id));
  appAtomRegistry.set(atom, new Map([...kept, [messageId, ask]]));
}

/** Brings back the ask a failed send marked. */
export function clearBotDigestAnswer(botKey: string, messageId: MessageId) {
  const atom = pendingAnswersAtom(botKey);
  appAtomRegistry.set(
    atom,
    new Map([...appAtomRegistry.get(atom)].filter(([id]) => id !== messageId)),
  );
}

// Outlives the digest's mount, so coming back while a read is in flight still knows the cached
// digest predates the answers settled since.
const readByBot = new Map<string, BotDigestRead>();

/** The asks to keep out of the digest: answered, and not yet settled in the digest read in hand. */
export function useAnsweredBotDigestAsks(
  botKey: string,
  conversation: BotDigestConversation,
  result: AsyncResult.AsyncResult<unknown, unknown>,
): ReadonlySet<string> {
  const pending = useAtomValue(pendingAnswersAtom(botKey));
  const readAt = AsyncResult.isSuccess(result) ? result.timestamp : null;
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
