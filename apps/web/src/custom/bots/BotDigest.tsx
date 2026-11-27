/**
 * A bot's digest above its composer — see `.fork/customizations.yaml#fork-bot-digest`.
 */
import { useAtomValue } from "@effect/atom-react";
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { ProjectReadFileResult, ScopedThreadRef } from "@t3tools/contracts";
import { AsyncResult, Atom } from "effect/reactivity";
import { XIcon } from "../icons/lucide-hugeicons";
import * as Schema from "effect/Schema";
import { type ReactNode, useState } from "react";

import { ComposerBanner } from "~/components/chat/ComposerBanner";
import { Button } from "~/components/ui/button";
import { toastManager } from "~/components/ui/toast";
import { useComposerDraftStore } from "~/composerDraftStore";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { cn, newMessageId } from "~/lib/utils";
import { useQuietThreadShell, useQuietThreadShells } from "~/state/entities";
import { useFilesystemReadAccess } from "~/state/filesystem";
import { projectEnvironment } from "~/state/projects";
import { revisionedQuery } from "~/state/revisionedQuery";

import { ForkQuestionOption } from "../ForkQuestionOption";

import {
  BotDigestLinkRow,
  type BotDigestThreads,
  resolveBotDigestLine,
  useOpenThread,
} from "./BotDigestItem";
import {
  type BotDigestItem,
  parseBotDigest,
  parseBotDigestStatus,
  quoteBotDigestAsk,
  splitBotDigestAsk,
} from "@t3tools/client-runtime/fork-bot-digest";
import { BOT_DIGEST_FILE } from "./botSeedFiles";
import { isListedBot } from "./botThreads";
import { botWorkOwnerId } from "./botWorkRoster";
import { BotChildApproval, BotChildQuestion } from "./BotChildRequests";
import {
  type BotDigestBottomState,
  BotDigestBottom,
  BotDigestShowDismissed,
} from "./BotDigestBottom";
import { waitingBotChildren } from "./waitingBotChildren";
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

/** The digest of the open thread when it is a bot, just above its composer: the status line and
    a card per Needs you ask. Nothing draws for any other thread, or while the bot has neither. */
export function BotDigestAsks(props: { readonly threadRef: ScopedThreadRef | null }) {
  const bot = useQuietThreadShell(props.threadRef);
  const botKey =
    bot === null || !isListedBot(bot)
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
  // One ask at a time, so the stack above the composer never grows with the list.
  const [page, setPage] = useState(0);
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
  // An ask that sends the owner to a work thread's question goes: the question itself is a card.
  const askedHere = (item: BotDigestItem) => {
    const question = resolveBotDigestLine(item, threads, botRef.environmentId).question;
    return (
      question !== undefined &&
      question.archivedAt === null &&
      question.environmentId === bot.environmentId &&
      botWorkOwnerId(question.source) === bot.id
    );
  };
  const open = allAsks.filter((item) => !answered.has(item.source) && !askedHere(item));
  const asks = open.filter((item) => !dismissed.includes(item.source));
  const hiddenCount = open.length - asks.length;
  // Everything that waits on the owner, one card at a time: the bot's work's approvals and
  // questions (BotChildRequests), then the digest's own asks.
  const { asking, approving } = waitingBotChildren(shells, bot);
  const entries: ReadonlyArray<
    | { readonly kind: "approval" | "question"; readonly child: EnvironmentThreadShell }
    | { readonly kind: "ask"; readonly item: BotDigestItem }
  > = [
    ...approving.map((child) => ({ kind: "approval" as const, child })),
    ...asking.map((child) => ({ kind: "question" as const, child })),
    ...asks.map((item) => ({ kind: "ask" as const, item })),
  ];
  if (entries.length === 0 && hiddenCount === 0 && status === null) return null;
  const at = Math.min(page, Math.max(0, entries.length - 1));
  const entry = entries[at];
  // Kept to the asks the digest still has, so the list cannot grow past them.
  const dismiss = (source: string) =>
    setDismissed([
      ...dismissed.filter((kept) => allAsks.some((ask) => ask.source === kept)),
      source,
    ]);
  // An answer goes to the bot as the owner's reply, quoting its ask, behind whatever it is doing.
  const answer = async (item: BotDigestItem, choice: string) => {
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
  const reply = (item: BotDigestItem, question: EnvironmentThreadShell | undefined) => {
    if (question !== undefined) {
      openThread(scopeThreadRef(question.environmentId, question.id));
      return;
    }
    const store = useComposerDraftStore.getState();
    const existing = store.getComposerDraft(botRef)?.prompt.trimEnd() ?? "";
    const quote = quoteBotDigestAsk(item.source);
    store.setPrompt(botRef, existing === "" ? quote : `${existing}\n\n${quote}`);
  };
  const showDismissed = () => setDismissed(NO_DISMISSED);
  const bottom: BotDigestBottomState = {
    paging: { at, count: entries.length, onPage: setPage },
    hiddenCount,
    onShowDismissed: showDismissed,
  };
  if (entry?.kind === "approval" || entry?.kind === "question") {
    const Card = entry.kind === "approval" ? BotChildApproval : BotChildQuestion;
    return (
      <Card
        key={`${entry.kind}:${entry.child.environmentId}:${entry.child.id}`}
        child={entry.child}
        bottom={bottom}
      />
    );
  }
  const item = entry?.kind === "ask" ? entry.item : undefined;
  const line =
    item === undefined ? null : resolveBotDigestLine(item, threads, botRef.environmentId);
  const ask = line === null ? null : splitBotDigestAsk(line.text);
  if (item === undefined || line === null || ask === null) {
    return (
      <BotDigestStatusView
        status={status}
        hiddenCount={hiddenCount}
        onShowDismissed={showDismissed}
      />
    );
  }
  return (
    <BotDigestAskCardView
      key={item.source}
      question={ask.question}
      detail={ask.detail}
      hasLinks={line.links.threads.length > 0 || line.links.pullRequests.length > 0}
      links={<BotDigestLinkRow links={line.links} environmentId={botRef.environmentId} />}
      answers={item.answers}
      bottom={bottom}
      onDismiss={() => dismiss(item.source)}
      onSend={(choice) => void answer(item, choice)}
      onReply={() => reply(item, line.question)}
    />
  );
}

/** The banner card the digest draws in, in the dock above the composer with its other cards.
    Outside the composer's own focus: a tap here never expands the collapsed phone composer. */
function BotDigestBanner(props: { readonly children: ReactNode }) {
  return (
    <ComposerBanner.Attachment data-fork-composer-aside="true" data-fork-bot-digest="">
      <ComposerBanner.Root data-chat-composer-top-drawer="true" variant="info">
        {props.children}
      </ComposerBanner.Root>
    </ComposerBanner.Attachment>
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

/** @public — one ask as the Questions card: the question heads it, the offered answers are its
    options, what it links sits in the bottom section with the pager, and nothing goes to the Petal until Send. Reply answers in
    your own words. Keyed by the ask, so a pick never carries over to the next one. */
export function BotDigestAskCardView(props: {
  readonly question: string;
  readonly detail: string | null;
  /** What the ask is about, shown in the bottom section; `hasLinks` says whether it draws any. */
  readonly links: ReactNode;
  readonly hasLinks: boolean;
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
      <div data-fork-pending-user-input="true" className="flex flex-col">
        <div data-fork-pending-user-input-question className="flex items-start gap-4 px-4 py-3">
          <div className="flex max-h-40 min-w-0 flex-1 flex-col gap-1 overflow-y-auto text-sm wrap-anywhere">
            {props.question === "" ? null : <p className="text-foreground">{props.question}</p>}
            {props.detail === null ? null : <p className="text-muted-foreground">{props.detail}</p>}
          </div>
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
        </div>
        {offered ? (
          <ComposerBanner.Scroll>
            <div className="flex flex-col px-2 pt-2 pb-3 wrap-anywhere">
              <p data-fork-question-hint className="px-2 pb-1 text-xs text-muted-foreground">
                Select one
              </p>
              <div className="flex flex-col gap-1" role="radiogroup">
                {answers.map((answer) => (
                  <ForkQuestionOption
                    key={answer}
                    label={answer}
                    multiSelect={false}
                    selected={choice === answer}
                    disabled={false}
                    onSelect={() => setChoice(answer)}
                  />
                ))}
              </div>
            </div>
          </ComposerBanner.Scroll>
        ) : null}
        <div
          data-fork-pending-user-input-footer
          className={cn("flex items-center gap-2 px-4 pb-3", !offered && "pt-3")}
        >
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
        </div>
        <BotDigestBottom {...props.bottom} links={props.links} hasLinks={props.hasLinks} ruled />
      </div>
    </BotDigestBanner>
  );
}
