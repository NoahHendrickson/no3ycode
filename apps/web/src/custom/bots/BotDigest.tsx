/**
 * A bot's digest above its composer — see `.fork/customizations.yaml#fork-bot-digest`.
 */
import { useAtomValue } from "@effect/atom-react";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { EnvironmentId, ProjectReadFileResult, ScopedThreadRef } from "@t3tools/contracts";
import { AsyncResult, Atom } from "effect/reactivity";
import { MessageCircleQuestionIcon, ReplyIcon } from "lucide-react";
import { type ReactNode, useState } from "react";

import { PullRequestGlyph } from "~/components/pullRequest/pullRequestIcons";
import { Button } from "~/components/ui/button";
import { useComposerDraftStore } from "~/composerDraftStore";
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
  return <BotDigestAsksFor bot={bot} />;
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
  // The answer each ask was given here, for the digest as it read then: once the bot rewrites it,
  // an ask it kept offers its answers again.
  const [sentFor, setSentFor] = useState<{
    readonly contents: string | null;
    readonly answers: ReadonlyMap<string, string>;
  }>({ contents: null, answers: NO_ANSWERS });
  const tellBot = useTellBot();
  const openThread = useOpenThread();
  const file = AsyncResult.getOrElse(result, () => null);
  const contents = file === null || file.exists === false ? null : file.contents;
  const asks =
    contents === null
      ? []
      : (parseBotDigest(contents).find((section) => section.kind === "needs-you")?.items ?? []);
  const status = contents === null ? null : parseBotDigestStatus(contents);
  if (asks.length === 0 && status === null) return null;
  const sent = sentFor.contents === contents ? sentFor.answers : NO_ANSWERS;
  const setSent = (
    update: (previous: ReadonlyMap<string, string>) => ReadonlyMap<string, string>,
  ) =>
    setSentFor((previous) => ({
      contents,
      answers: update(previous.contents === contents ? previous.answers : NO_ANSWERS),
    }));
  // An answer goes to the bot as the owner's reply, quoting its ask, behind whatever it is doing.
  const answer = async (item: BotDigestItem, choice: string) => {
    setSent((previous) => new Map(previous).set(item.source, choice));
    if (await tellBot(botRef, `> ${item.source}\n\n${choice}`)) return;
    setSent((previous) => {
      const next = new Map(previous);
      next.delete(item.source);
      return next;
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
  return (
    <div data-fork-bot-digest="" className="flex flex-col gap-2 pb-2">
      {status === null ? null : (
        <p data-testid="bot-digest-status" className="px-1 text-xs text-muted-foreground">
          {status}
        </p>
      )}
      {asks.map((item) => {
        const line = resolveBotDigestLine(item, threads, botRef.environmentId);
        const { question, detail } = splitBotDigestAsk(line.text);
        const given = sent.get(item.source);
        const offered = item.answers.length > 0 && given === undefined;
        return (
          <BotDigestAskCard
            key={item.source}
            question={question}
            detail={detail}
            pullRequest={line.links.pullRequests[0] ?? null}
            environmentId={botRef.environmentId}
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
        );
      })}
    </div>
  );
}

/** One ask as a card. A tile leads it in the ask's colour: the state of the pull request it is
    about (open, draft, merged, closed), or the sidebar's needs-input colour. Beside the tile it
    reads top to bottom: the question, its detail, what it links, then what you can do. */
function BotDigestAskCard(props: {
  readonly question: string;
  readonly detail: string | null;
  readonly pullRequest: BotPullRequest | null;
  readonly environmentId: EnvironmentId;
  readonly links: ReactNode;
  readonly actions: ReactNode;
}) {
  const { state } = useBotPullRequestState(props.pullRequest, props.environmentId);
  const Icon =
    props.pullRequest === null
      ? MessageCircleQuestionIcon
      : (state?.Icon ?? PullRequestGlyph.pullRequest);
  return (
    <div
      data-fork-bot-digest-ask=""
      className="flex min-w-0 gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground"
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
    </div>
  );
}
