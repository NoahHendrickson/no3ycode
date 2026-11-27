/**
 * A bot's digest above its composer — see `.fork/customizations.yaml#fork-bot-digest`.
 */
import { useAtomValue } from "@effect/atom-react";
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { BotDigestLinks } from "@t3tools/client-runtime/fork-bot-digest-links";
import type { EnvironmentId, ProjectReadFileResult, ScopedThreadRef } from "@t3tools/contracts";
import { AsyncResult, Atom } from "effect/reactivity";
import { XIcon } from "../icons/lucide-hugeicons";
import * as Schema from "effect/Schema";
import { useState } from "react";

import { ComposerBanner } from "~/components/chat/ComposerBanner";
import { Button } from "~/components/ui/button";
import { toastManager } from "~/components/ui/toast";
import { useComposerDraftStore } from "~/composerDraftStore";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { newMessageId } from "~/lib/utils";
import { useQuietThreadShell, useQuietThreadShells } from "~/state/entities";
import { useFilesystemReadAccess } from "~/state/filesystem";
import { projectEnvironment } from "~/state/projects";
import { revisionedQuery } from "~/state/revisionedQuery";

import { ForkQuestionCard } from "../ForkQuestionCard";
import { ForkQuestionOption } from "../ForkQuestionOption";

import { type BotDigestThreads, resolveBotDigestLine, useOpenThread } from "./BotDigestItem";
import {
  type BotDigestItem,
  parseBotDigest,
  parseBotDigestStatus,
  quoteBotDigestAsk,
  splitBotDigestAsk,
} from "@t3tools/client-runtime/fork-bot-digest";
import { BOT_DIGEST_FILE } from "./botSeedFiles";
import { isListedBot } from "./botThreads";
import { isSprintThread } from "../sprints/sprintThreads";
import { BotChildApproval, BotChildQuestion } from "./BotChildRequests";
import {
  BotDigestBanner,
  BotDigestBottom,
  type BotDigestBottomState,
  BotDigestShowDismissed,
} from "./BotDigestBottom";
import { type BotDigestPage, botDigestPageAt, deriveBotDigestStack } from "./botDigestStack";
import {
  type BotDigestConversation,
  clearBotDigestAnswer,
  markBotDigestAnswer,
  useAnsweredBotDigestAsks,
  useBotDigestConversation,
} from "./useAnsweredBotDigestAsks";
import { useTellBot } from "./useTellBot";

const NO_DIGEST = Atom.make(AsyncResult.initial<ProjectReadFileResult, never>(false)).pipe(
  Atom.withLabel("bot-digest:none"),
);
const DismissedAsks = Schema.Array(Schema.String);
const NO_DISMISSED: ReadonlyArray<string> = [];

/** The digest of the open thread when it is a bot, just above its composer: one card at a time
    for everything that waits on the owner (botDigestStack), else its status line. Nothing draws
    for any other thread, or while the bot has neither. */
export function BotDigestAsks(props: { readonly threadRef: ScopedThreadRef | null }) {
  const bot = useQuietThreadShell(props.threadRef);
  // A sprint answers its threads inline, on the card under the report (fork-thread-launch-cards).
  const botKey =
    bot === null || !isListedBot(bot) || isSprintThread(bot.source)
      ? null
      : scopedThreadKey(scopeThreadRef(bot.environmentId, bot.id));
  // Its answers are read off the conversation, so nothing draws until it loads.
  const conversation = useBotDigestConversation(botKey);
  if (bot === null || botKey === null || conversation === null) return null;
  // Keyed by the bot, so one Petal's state never carries over to the next.
  return <BotDigestAsksFor key={botKey} bot={bot} conversation={conversation} />;
}

function BotDigestAsksFor(props: {
  readonly bot: Pick<EnvironmentThreadShell, "id" | "environmentId" | "worktreePath">;
  readonly conversation: BotDigestConversation;
}) {
  const { bot, conversation } = props;
  const botRef = scopeThreadRef(bot.environmentId, bot.id);
  const { canReadFiles } = useFilesystemReadAccess(bot.environmentId);
  const query =
    canReadFiles && bot.worktreePath !== null
      ? projectEnvironment.readFile({
          environmentId: bot.environmentId,
          input: { cwd: bot.worktreePath, relativePath: BOT_DIGEST_FILE, allowMissing: true },
        })
      : NO_DIGEST;
  // The bot rewrites its digest during a turn, so each run it starts or ends reads it again: read
  // off the conversation, so a read never lands before the answers it settles.
  const result = useAtomValue(
    revisionedQuery(query, canReadFiles ? conversation.revision : undefined),
  );
  const shells = useQuietThreadShells();
  const botKey = scopedThreadKey(botRef);
  // Put away on this device, by the ask as written: one the bot rewrites comes back.
  const [dismissed, setDismissed] = useLocalStorage(
    `t3code:fork:bot-digest-dismissed:${botKey}`,
    NO_DISMISSED,
    DismissedAsks,
  );
  // One card at a time, so the stack above the composer never grows with the list.
  const [page, setPage] = useState<BotDigestPage>({ key: null, index: 0 });
  const tellBot = useTellBot();
  const openThread = useOpenThread();
  const file = AsyncResult.getOrElse(result, () => null);
  const contents = file === null || file.exists === false ? null : file.contents;
  const allAsks =
    contents === null
      ? []
      : (parseBotDigest(contents).find((section) => section.kind === "needs-you")?.items ?? []);
  const status = contents === null ? null : parseBotDigestStatus(contents);
  // An answered ask goes away until the bot settles the run that reads the answer and the digest
  // is read again; one it keeps then comes back.
  const answered = useAnsweredBotDigestAsks(botKey, conversation, result);
  const threads: BotDigestThreads = { shells };
  const lineOf = (item: BotDigestItem) => resolveBotDigestLine(item, threads, botRef.environmentId);
  const { entries, hiddenCount } = deriveBotDigestStack({
    threads: shells,
    bot,
    asks: allAsks,
    answered,
    dismissed,
    questionOf: (item) => lineOf(item).question,
  });
  if (entries.length === 0 && hiddenCount === 0 && status === null) return null;
  const at = botDigestPageAt(entries, page);
  const entry = entries[at];
  const showDismissed = () => setDismissed(NO_DISMISSED);
  if (entry === undefined) {
    return (
      <BotDigestStatusView
        status={status}
        hiddenCount={hiddenCount}
        onShowDismissed={showDismissed}
      />
    );
  }
  const bottom: BotDigestBottomState = {
    paging: {
      at,
      count: entries.length,
      onPage: (index) => setPage({ key: entries[index]?.key ?? null, index }),
    },
    hiddenCount,
    onShowDismissed: showDismissed,
  };
  if (entry.kind !== "ask") {
    const Card = entry.kind === "approval" ? BotChildApproval : BotChildQuestion;
    return <Card key={entry.key} child={entry.child} bottom={bottom} />;
  }
  const { item } = entry;
  const line = lineOf(item);
  const ask = splitBotDigestAsk(line.text);
  // Kept to the asks the digest still has, so the list cannot grow past them.
  const dismiss = () =>
    setDismissed([
      ...dismissed.filter((kept) => allAsks.some((candidate) => candidate.source === kept)),
      item.source,
    ]);
  // An answer goes to the bot as the owner's reply, quoting its ask, behind whatever it is doing.
  const answer = async (choice: string) => {
    const messageId = newMessageId();
    markBotDigestAnswer(botKey, messageId, item.source, conversation);
    if (await tellBot(botRef, `${quoteBotDigestAsk(item.source)}${choice}`, messageId)) return;
    clearBotDigestAnswer(botKey, messageId);
    toastManager.add({
      type: "error",
      title: "Could not send your answer",
      description: "The Petal did not get it. Try again, or use Reply.",
    });
  };
  // An ask whose linked thread waits on a question opens that thread to answer it there; any
  // other is quoted into the composer beneath.
  const reply = () => {
    if (line.question !== undefined) {
      openThread(scopeThreadRef(line.question.environmentId, line.question.id));
      return;
    }
    const store = useComposerDraftStore.getState();
    const existing = store.getComposerDraft(botRef)?.prompt.trimEnd() ?? "";
    const quote = quoteBotDigestAsk(item.source);
    store.setPrompt(botRef, existing === "" ? quote : `${existing}\n\n${quote}`);
  };
  return (
    <BotDigestAskCardView
      key={entry.key}
      question={ask.question}
      detail={ask.detail}
      links={line.links}
      environmentId={botRef.environmentId}
      answers={item.answers}
      bottom={bottom}
      onDismiss={dismiss}
      onSend={(choice) => void answer(choice)}
      onReply={reply}
    />
  );
}

/** @public — the digest with nothing to ask: one line of where the Petal stands. */
export function BotDigestStatusView(props: {
  readonly status: string | null;
  readonly hiddenCount: number;
  readonly onShowDismissed: () => void;
}) {
  if (props.status === null && props.hiddenCount === 0) return null;
  return (
    <BotDigestBanner>
      <ComposerBanner.Row className="min-h-8">
        <ComposerBanner.Content>
          <span data-testid="bot-digest-status" className="min-w-0 truncate text-muted-foreground">
            {props.status ?? "Needs you"}
          </span>
        </ComposerBanner.Content>
        {props.hiddenCount === 0 ? null : (
          <ComposerBanner.Actions>
            <BotDigestShowDismissed count={props.hiddenCount} onClick={props.onShowDismissed} />
          </ComposerBanner.Actions>
        )}
      </ComposerBanner.Row>
    </BotDigestBanner>
  );
}

/** @public — one ask as the Questions card: the question and its detail head it, the offered
    answers are its options, and nothing goes to the Petal until Send; Reply answers in your own
    words. What it links sits in the bottom section with the pager. Keyed by the ask, so a pick
    never carries over to the next one. */
export function BotDigestAskCardView(props: {
  readonly question: string;
  readonly detail: string | null;
  readonly links: BotDigestLinks;
  readonly environmentId: EnvironmentId;
  readonly answers: ReadonlyArray<string>;
  /** Paging and dismissed asks, shared by every card the digest pages through. */
  readonly bottom: BotDigestBottomState;
  readonly onDismiss: () => void;
  readonly onSend: (choice: string) => void;
  readonly onReply: () => void;
}) {
  const { answers } = props;
  const [choice, setChoice] = useState<string | null>(null);
  const offered = answers.length > 0;
  return (
    <BotDigestBanner>
      <ForkQuestionCard
        question={
          <>
            {props.question === "" ? null : <p className="text-foreground">{props.question}</p>}
            {props.detail === null ? null : <p className="text-muted-foreground">{props.detail}</p>}
          </>
        }
        aside={
          <Button
            size="icon-sm"
            variant="ghost"
            className="-my-1 shrink-0"
            aria-label="Dismiss"
            onClick={props.onDismiss}
            data-testid="bot-digest-dismiss"
          >
            <XIcon />
          </Button>
        }
        hint="Select one"
        options={
          offered
            ? answers.map((answer) => (
                <ForkQuestionOption
                  key={answer}
                  label={answer}
                  multiSelect={false}
                  selected={choice === answer}
                  disabled={false}
                  onSelect={() => setChoice(answer)}
                />
              ))
            : undefined
        }
        actions={
          <>
            {offered ? (
              <Button
                size="sm"
                variant="default"
                data-fork-composer-notice-action="primary"
                disabled={choice === null}
                onClick={() => {
                  if (choice !== null) props.onSend(choice);
                }}
                data-testid="bot-digest-send"
              >
                Send
              </Button>
            ) : null}
            <Button
              size="sm"
              // Beside offered answers it is for anything else; alone it is the way to answer.
              variant={offered ? "outline" : "default"}
              data-fork-composer-notice-action={offered ? "secondary" : "primary"}
              onClick={props.onReply}
              data-testid="bot-digest-reply"
            >
              Reply
            </Button>
          </>
        }
        footer={
          <BotDigestBottom
            {...props.bottom}
            links={props.links}
            environmentId={props.environmentId}
          />
        }
      />
    </BotDigestBanner>
  );
}
