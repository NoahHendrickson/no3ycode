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
  MessageCircleQuestionIcon,
  ReplyIcon,
  XIcon,
} from "lucide-react";
import * as Schema from "effect/Schema";
import { type ReactNode, useState } from "react";

import { PullRequestGlyph } from "~/components/pullRequest/pullRequestIcons";
import { Button } from "~/components/ui/button";
import { toastManager } from "~/components/ui/toast";
import { useComposerDraftStore } from "~/composerDraftStore";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { cn, newMessageId } from "~/lib/utils";
import { readThreadShell, useQuietThreadShell, useQuietThreadShells } from "~/state/entities";
import { useFilesystemReadAccess } from "~/state/filesystem";
import { projectEnvironment } from "~/state/projects";
import { revisionedQuery } from "~/state/revisionedQuery";
import { threadEnvironment } from "~/state/threads";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";
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
  splitBotDigestAsk,
} from "./botDigestSections";
import type { BotPullRequest } from "./botDigestItemLinks";
import { useBotPullRequestState } from "./BotPullRequestMark";
import { BOT_DIGEST_FILE } from "./botSeedFiles";
import { isListedBot } from "./botThreads";

const NO_DIGEST = Atom.make(AsyncResult.initial<ProjectReadFileResult, never>(false)).pipe(
  Atom.withLabel("bot-digest:none"),
);
const NO_ANSWERS: ReadonlyMap<string, string> = new Map();
const DismissedAsks = Schema.Array(Schema.String);
const NO_DISMISSED: ReadonlyArray<string> = [];
const SETTLED_RUN = new Set(["completed", "interrupted", "failed", "cancelled", "rolled_back"]);

/** Queues `text` as the owner's message to the bot, behind whatever it is doing; false when it
    could not be sent. */
function useTellBot(): (botRef: ScopedThreadRef, text: string) => Promise<boolean> {
  const startTurn = useOrchestrationCommand(threadEnvironment.startTurn);
  return async (botRef, text) => {
    const shell = readThreadShell(botRef);
    if (shell === null) return false;
    const result = await startTurn({
      environmentId: botRef.environmentId,
      input: {
        threadId: botRef.threadId,
        message: { messageId: newMessageId(), role: "user", text, attachments: [] },
        runtimeMode: shell.runtimeMode,
        interactionMode: shell.interactionMode,
        dispatchMode: "queue",
        createdAt: new Date().toISOString(),
      },
    });
    return result._tag === "Success";
  };
}

/** The digest of the open thread when it is a bot, just above its composer: the status line and
    a card per Needs you ask. Nothing draws for any other thread, or while the bot has neither. */
export function BotDigestAsks(props: { readonly threadRef: ScopedThreadRef | null }) {
  const bot = useQuietThreadShell(props.threadRef);
  if (bot === null || !isListedBot(bot)) return null;
  // Keyed by the bot, so one Petal's sent answers never carry over to the next.
  return (
    <BotDigestAsksFor key={scopedThreadKey(scopeThreadRef(bot.environmentId, bot.id))} bot={bot} />
  );
}

function BotDigestAsksFor(props: {
  readonly bot: Pick<EnvironmentThreadShell, "id" | "environmentId" | "worktreePath" | "latestRun">;
}) {
  const { bot } = props;
  const botRef = scopeThreadRef(bot.environmentId, bot.id);
  const { canReadFiles } = useFilesystemReadAccess(bot.environmentId);
  const query =
    canReadFiles && bot.worktreePath !== null
      ? projectEnvironment.readFile({
          environmentId: bot.environmentId,
          input: { cwd: bot.worktreePath, relativePath: BOT_DIGEST_FILE, allowMissing: true },
        })
      : NO_DIGEST;
  // The bot rewrites its digest during a turn, so each run it starts or ends reads it again.
  const revision = bot.latestRun === null ? null : `${bot.latestRun.runId}:${bot.latestRun.status}`;
  const result = useAtomValue(revisionedQuery(query, canReadFiles ? revision : undefined));
  const shells = useQuietThreadShells();
  const localVisits = useUiStateStore((state) => state.threadLastVisitedAtById);
  // The answer each ask was given here, until the bot settles a run after it: the digest read then
  // is the bot's word, and an ask it kept offers its answers again.
  const [sentFor, setSentFor] = useState<{
    readonly revision: string | null;
    readonly answers: ReadonlyMap<string, string>;
  }>({ revision: null, answers: NO_ANSWERS });
  // Put away on this device, by the ask as written: one the bot rewrites comes back.
  const [dismissed, setDismissed] = useLocalStorage(
    `t3code:fork:bot-digest-dismissed:${scopedThreadKey(botRef)}`,
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
  const asks = allAsks.filter((item) => !dismissed.includes(item.source));
  const hiddenCount = allAsks.length - asks.length;
  const status = contents === null ? null : parseBotDigestStatus(contents);
  const settled = bot.latestRun === null || SETTLED_RUN.has(bot.latestRun.status);
  const expired = sentFor.revision !== revision && settled;
  // Retired for good once a run settles after them, so the bot's next run cannot bring them back.
  if (expired && sentFor.answers.size > 0) setSentFor({ revision, answers: NO_ANSWERS });
  if (allAsks.length === 0 && status === null) return null;
  const at = Math.min(page, Math.max(0, asks.length - 1));
  const item = asks[at];
  // Kept to the asks the digest still has, so the list cannot grow past them.
  const dismiss = (source: string) =>
    setDismissed([
      ...dismissed.filter((kept) => allAsks.some((ask) => ask.source === kept)),
      source,
    ]);
  const sent = expired ? NO_ANSWERS : sentFor.answers;
  // An answer goes to the bot as the owner's reply, quoting its ask, behind whatever it is doing.
  const answer = async (item: BotDigestItem, choice: string) => {
    setSentFor((previous) => ({
      revision,
      answers: new Map(previous.answers).set(item.source, choice),
    }));
    if (await tellBot(botRef, `> ${item.source}\n\n${choice}`)) return;
    // Only this attempt's entry: another card answered meanwhile keeps its own.
    setSentFor((previous) => {
      const answers = new Map(previous.answers);
      answers.delete(item.source);
      return { ...previous, answers };
    });
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
    const quote = `> ${item.source}\n\n`;
    store.setPrompt(botRef, existing === "" ? quote : `${existing}\n\n${quote}`);
  };
  const threads: BotDigestThreads = { shells, localVisits };
  const line =
    item === undefined ? null : resolveBotDigestLine(item, threads, botRef.environmentId);
  const ask = line === null ? null : splitBotDigestAsk(line.text);
  const given = item === undefined ? undefined : sent.get(item.source);
  const offered = item !== undefined && item.answers.length > 0 && given === undefined;
  return (
    <div data-fork-bot-digest="" className="pb-2">
      {/* The composer's two layers, worn by its stamps so each theme paints it as the composer: the
          vessel's own strip names where the bot stands, and the ask is the surface inside it. */}
      <div data-fork-composer-vessel="true" className="flex min-w-0 flex-col rounded-lg">
        <div className="flex min-h-8 items-center gap-2 py-1 pr-1.5 pl-3 text-xs text-muted-foreground">
          <span data-testid="bot-digest-status" className="min-w-0 flex-1 truncate">
            {status ?? "Needs you"}
          </span>
          {hiddenCount === 0 ? null : (
            <Button
              size="micro"
              variant="ghost"
              onClick={() => setDismissed(NO_DISMISSED)}
              data-testid="bot-digest-show-dismissed"
            >
              Show {hiddenCount} dismissed
            </Button>
          )}
          {asks.length < 2 ? null : (
            <span className="flex shrink-0 items-center gap-0.5 tabular-nums">
              <Button
                size="icon-micro"
                variant="ghost"
                aria-label="Previous ask"
                disabled={at === 0}
                onClick={() => setPage(at - 1)}
              >
                <ChevronLeftIcon />
              </Button>
              {at + 1} of {asks.length}
              <Button
                size="icon-micro"
                variant="ghost"
                aria-label="Next ask"
                disabled={at === asks.length - 1}
                onClick={() => setPage(at + 1)}
              >
                <ChevronRightIcon />
              </Button>
            </span>
          )}
        </div>
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
              <>
                {given === undefined ? null : (
                  <span className="text-xs text-muted-foreground" data-testid="bot-digest-sent">
                    Sent “{given}”
                  </span>
                )}
                {offered
                  ? item.answers.map((choice) => (
                      <Button
                        key={choice}
                        size="xs"
                        variant="outline"
                        onClick={() => void answer(item, choice)}
                        data-testid="bot-digest-answer"
                      >
                        {choice}
                      </Button>
                    ))
                  : null}
                <Button
                  size="xs"
                  // Beside answers it is for anything else; alone it is the way to answer.
                  variant={offered ? "ghost" : "outline"}
                  onClick={() => reply(item, line.question)}
                  data-testid="bot-digest-reply"
                >
                  <ReplyIcon />
                  Reply
                </Button>
              </>
            }
          />
        )}
      </div>
    </div>
  );
}

/** One ask as the vessel's surface. A tile leads it in the ask's colour: the state of the pull request it is
    about (open, draft, merged, closed), or the sidebar's needs-input colour. Beside the tile it
    reads top to bottom: the question, its detail, what it links, then what you can do. */
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
  const Icon =
    props.pullRequest === null
      ? MessageCircleQuestionIcon
      : (state?.Icon ?? PullRequestGlyph.pullRequest);
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
            props.pullRequest === null
              ? "text-sidebar-v2-status-input"
              : (state?.toneClassName ?? "text-muted-foreground"),
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
