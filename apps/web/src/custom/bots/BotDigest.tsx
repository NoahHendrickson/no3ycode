/**
 * A bot's digest above its composer — see `.fork/customizations.yaml#fork-bot-digest`.
 */
import { useAtomValue } from "@effect/atom-react";
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { EnvironmentId, ProjectReadFileResult, ScopedThreadRef } from "@t3tools/contracts";
import { AsyncResult, Atom } from "effect/reactivity";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  type LucideIcon,
  MessageCircleQuestionIcon,
  ReplyIcon,
  XIcon,
} from "lucide-react";
import * as Schema from "effect/Schema";
import { type ReactNode, useState } from "react";

import {
  PullRequestGlyph,
  type PullRequestStatePresentation,
} from "~/components/pullRequest/pullRequestIcons";
import { Button } from "~/components/ui/button";
import { toastManager } from "~/components/ui/toast";
import { useComposerDraftStore } from "~/composerDraftStore";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { cn, newMessageId } from "~/lib/utils";
import { useQuietThreadShell, useQuietThreadShells } from "~/state/entities";
import { useFilesystemReadAccess } from "~/state/filesystem";
import { projectEnvironment } from "~/state/projects";
import { revisionedQuery } from "~/state/revisionedQuery";
import { useUiStateStore } from "~/uiStateStore";

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
import type { BotPullRequest } from "@t3tools/client-runtime/fork-bot-digest-links";
import { useBotPullRequestState } from "./BotPullRequestMark";
import { BOT_DIGEST_FILE } from "./botSeedFiles";
import { isListedBot } from "./botThreads";
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
  const localVisits = useUiStateStore((state) => state.threadLastVisitedAtById);
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
  const open = allAsks.filter((item) => !answered.has(item.source));
  const asks = open.filter((item) => !dismissed.includes(item.source));
  const hiddenCount = open.length - asks.length;
  if (open.length === 0 && status === null) return null;
  const at = Math.min(page, Math.max(0, asks.length - 1));
  const item = asks[at];
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
  const threads: BotDigestThreads = { shells, localVisits };
  const line =
    item === undefined ? null : resolveBotDigestLine(item, threads, botRef.environmentId);
  const ask = line === null ? null : splitBotDigestAsk(line.text);
  return (
    <BotDigestView
      status={status}
      hiddenCount={hiddenCount}
      onShowDismissed={() => setDismissed(NO_DISMISSED)}
      askKeys={asks.map((entry) => entry.source)}
      at={at}
      onPage={setPage}
    >
      {item === undefined || line === null || ask === null ? null : (
        <BotDigestAskCard
          key={item.source}
          question={ask.question}
          detail={ask.detail}
          pullRequest={line.links.pullRequests[0] ?? null}
          environmentId={botRef.environmentId}
          onDismiss={() => dismiss(item.source)}
          links={
            <BotDigestLinkRow
              links={line.links}
              environmentId={botRef.environmentId}
              localVisits={localVisits}
            />
          }
          actions={
            <BotDigestAskActions
              answers={item.answers}
              onAnswer={(choice) => void answer(item, choice)}
              onReply={() => reply(item, line.question)}
            />
          }
        />
      )}
    </BotDigestView>
  );
}

/** @public — the digest as drawn, from plain data; Storybook renders it on its own. `askKeys`
    names the asks on the pager, `at` the one on show, and `children` is its card. */
export function BotDigestView(props: {
  readonly status: string | null;
  readonly hiddenCount: number;
  readonly onShowDismissed: () => void;
  readonly askKeys: ReadonlyArray<string>;
  readonly at: number;
  readonly onPage: (index: number) => void;
  readonly children?: ReactNode;
}) {
  const { askKeys, at, onPage } = props;
  return (
    <div data-fork-bot-digest="" className="pb-2">
      {/* The composer's two layers, worn by its stamps so each theme paints it as the composer: the
          vessel's own strip names where the bot stands, and the ask is the surface inside it. */}
      <div data-fork-composer-vessel="true" className="flex min-w-0 flex-col rounded-lg">
        <div className="flex min-h-8 items-center gap-2 py-1 pr-1.5 pl-3 text-xs text-muted-foreground">
          <span data-testid="bot-digest-status" className="min-w-0 flex-1 truncate">
            {props.status ?? "Needs you"}
          </span>
          {props.hiddenCount === 0 ? null : (
            <Button
              size="micro"
              variant="ghost"
              onClick={props.onShowDismissed}
              data-testid="bot-digest-show-dismissed"
            >
              Show {props.hiddenCount} dismissed
            </Button>
          )}
          {askKeys.length < 2 ? null : (
            <span className="flex shrink-0 items-center gap-0.5">
              <Button
                size="icon-micro"
                variant="ghost"
                aria-label="Previous ask"
                disabled={at === 0}
                onClick={() => onPage(at - 1)}
              >
                <ChevronLeftIcon />
              </Button>
              {/* A dot per ask, the one on show a rounded dash; each opens its ask. */}
              <span className="flex items-center gap-1 px-0.5">
                {askKeys.map((key, index) => (
                  <button
                    key={key}
                    type="button"
                    aria-label={`Ask ${index + 1} of ${askKeys.length}`}
                    aria-current={index === at ? "true" : undefined}
                    onClick={() => onPage(index)}
                    className={cn(
                      "h-1.5 cursor-pointer rounded-full transition-[width,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                      index === at
                        ? "w-3.5 bg-foreground"
                        : "w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground/70",
                    )}
                  />
                ))}
              </span>
              <Button
                size="icon-micro"
                variant="ghost"
                aria-label="Next ask"
                disabled={at === askKeys.length - 1}
                onClick={() => onPage(at + 1)}
              >
                <ChevronRightIcon />
              </Button>
            </span>
          )}
        </div>
        {props.children}
      </div>
    </div>
  );
}

/** @public — an ask's buttons: each offered answer, then Reply. */
export function BotDigestAskActions(props: {
  readonly answers: ReadonlyArray<string>;
  readonly onAnswer: (choice: string) => void;
  readonly onReply: () => void;
}) {
  const offered = props.answers.length > 0;
  return (
    <>
      {props.answers.map((choice) => (
        <Button
          key={choice}
          size="xs"
          variant="outline"
          onClick={() => props.onAnswer(choice)}
          data-testid="bot-digest-answer"
        >
          {choice}
        </Button>
      ))}
      <Button
        size="xs"
        // Beside answers it is for anything else; alone it is the way to answer.
        variant={offered ? "ghost" : "outline"}
        onClick={props.onReply}
        data-testid="bot-digest-reply"
      >
        <ReplyIcon />
        Reply
      </Button>
    </>
  );
}

/** One ask as the vessel's surface. A tile leads it in the ask's colour: the state of the pull request it is
    about (open, draft, merged, closed), or the sidebar's needs-input colour. */
function BotDigestAskCard(props: {
  readonly question: string;
  readonly detail: string | null;
  readonly pullRequest: BotPullRequest | null;
  readonly environmentId: EnvironmentId;
  readonly links: ReactNode;
  readonly actions: ReactNode;
  readonly onDismiss: () => void;
}) {
  const { state } = useBotPullRequestState(props.pullRequest, props.environmentId);
  const tile = botDigestAskTile(props.pullRequest !== null, state);
  return (
    <BotDigestAskCardView
      question={props.question}
      detail={props.detail}
      icon={tile.icon}
      toneClassName={tile.toneClassName}
      links={props.links}
      actions={props.actions}
      onDismiss={props.onDismiss}
    />
  );
}

/** @public — an ask's tile: its pull request's state glyph and tone (the plain glyph while its
    state is unknown), else the sidebar's needs-input question. */
export function botDigestAskTile(
  hasPullRequest: boolean,
  state: PullRequestStatePresentation | null,
): { readonly icon: LucideIcon; readonly toneClassName: string } {
  if (!hasPullRequest) {
    return { icon: MessageCircleQuestionIcon, toneClassName: "text-sidebar-v2-status-input" };
  }
  return {
    icon: state?.Icon ?? PullRequestGlyph.pullRequest,
    toneClassName: state?.toneClassName ?? "text-muted-foreground",
  };
}

/** @public — the ask card as drawn; Storybook renders it on its own. Beside the tile it reads
    top to bottom: the question, its detail, what it links, then what you can do. */
export function BotDigestAskCardView(props: {
  readonly question: string;
  readonly detail: string | null;
  readonly icon: LucideIcon;
  readonly toneClassName: string;
  readonly links: ReactNode;
  readonly actions: ReactNode;
  readonly onDismiss: () => void;
}) {
  const Icon = props.icon;
  return (
    <div data-fork-composer-box="true">
      <div
        data-fork-composer-surface="true"
        data-fork-bot-digest-ask=""
        className="flex min-w-0 gap-3 p-3 text-card-foreground"
      >
        <span
          aria-hidden
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-[color-mix(in_srgb,currentColor_14%,transparent)]",
            props.toneClassName,
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {props.question === "" ? null : (
            <p className="text-sm leading-5 font-medium break-words text-foreground">
              {props.question}
            </p>
          )}
          {props.detail === null ? null : (
            <p className="line-clamp-2 text-xs leading-4 break-words text-muted-foreground">
              {props.detail}
            </p>
          )}
          {props.links}
          <div className="flex flex-wrap items-center gap-1.5 pt-1.5">{props.actions}</div>
        </div>
        <Button
          size="icon-micro"
          variant="ghost"
          aria-label="Dismiss"
          onClick={props.onDismiss}
          data-testid="bot-digest-dismiss"
        >
          <XIcon />
        </Button>
      </div>
    </div>
  );
}
