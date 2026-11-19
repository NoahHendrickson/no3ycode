/**
 * A bot's digest at the top of its Threads panel — see `.fork/customizations.yaml#fork-bot-digest`.
 */
import { useAtomValue } from "@effect/atom-react";
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { ProjectReadFileResult, ScopedThreadRef } from "@t3tools/contracts";
import { AsyncResult, Atom } from "effect/reactivity";
import * as Schema from "effect/Schema";
import { ReplyIcon, XIcon } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { useComposerDraftStore } from "~/composerDraftStore";
import {
  readLocalStorageValue,
  useLocalStorage,
  writeLocalStorageValue,
} from "~/hooks/useLocalStorage";
import { useResizeDrag } from "~/hooks/useResizeDrag";
import { newMessageId } from "~/lib/utils";
import { readThreadShell } from "~/state/entities";
import { useFilesystemReadAccess } from "~/state/filesystem";
import { projectEnvironment } from "~/state/projects";
import { revisionedQuery } from "~/state/revisionedQuery";
import { threadEnvironment } from "~/state/threads";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";

import { SidebarV2SectionLabel } from "../SidebarV2SectionLabel";
import {
  BotDigestLinkRow,
  type BotDigestThreads,
  BotDigestWords,
  resolveBotDigestLine,
  useOpenThread,
} from "./BotDigestItem";
import {
  type BotDigestItem,
  type BotDigestSection,
  botDigestSectionKey,
  parseBotDigest,
  parseBotDigestStatus,
} from "./botDigestSections";
import { BOT_DIGEST_FILE } from "./botSeedFiles";
import { closeBotThreadsPanel } from "./botThreadsPanelStore";

const NO_DIGEST = Atom.make(AsyncResult.initial<ProjectReadFileResult, never>(false)).pipe(
  Atom.withLabel("bot-digest:none"),
);

/** The saved height is the digest's tallest: a shorter digest keeps its own height, and a drag
    starts from what is on screen. One height serves every bot. */
const HEIGHT_STORAGE_KEY = "t3code:fork:bot-digest-height";
const DEFAULT_HEIGHT = 240;
const MIN_HEIGHT = 64;
/** What the drag leaves the thread list below it. */
const LIST_MIN_HEIGHT = 96;
const StoredHeight = Schema.Finite;
const DismissedKeys = Schema.Array(Schema.String);
/** New and In progress fold under one Updates row; one choice for every bot. */
const UPDATES_OPEN_STORAGE_KEY = "t3code:fork:bot-digest-updates-open";
const NO_DISMISSED: ReadonlyArray<string> = [];
const NO_ANSWERS: ReadonlyMap<string, string> = new Map();

const CARD_CLASS_NAME = "rounded-lg border border-border bg-card text-card-foreground";
const LIST_CLASS_NAME = "min-h-24 flex-1 overflow-y-auto";

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

/** The digest's sections with something in them, as cards above `children` (the thread list),
    split from it by a rule that drags to resize the digest. A dismissed card stays away until
    the bot changes it; nothing draws above the list while the digest is empty or unreadable. */
export function BotDigest(props: {
  readonly bot: Pick<EnvironmentThreadShell, "id" | "environmentId" | "worktreePath" | "latestRun">;
  readonly threads: BotDigestThreads;
  /** The panel is a sheet, which covers the composer a Reply lands in. */
  readonly sheet: boolean;
  readonly children: ReactNode;
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
  const dismissedKey = `t3code:fork:bot-digest-dismissed:${scopedThreadKey(botRef)}`;
  const [dismissed, setDismissed] = useLocalStorage(dismissedKey, NO_DISMISSED, DismissedKeys);
  const [height, setHeight] = useLocalStorage(HEIGHT_STORAGE_KEY, DEFAULT_HEIGHT, StoredHeight);
  const [updatesOpen, setUpdatesOpen] = useLocalStorage(
    UPDATES_OPEN_STORAGE_KEY,
    false,
    Schema.Boolean,
  );
  // The answer each ask was given here, for the digest as it read then: once the bot rewrites it,
  // an ask it kept offers its answers again.
  const [sentFor, setSentFor] = useState<{
    readonly contents: string | null;
    readonly answers: ReadonlyMap<string, string>;
  }>({ contents: null, answers: new Map() });
  const tellBot = useTellBot();
  // The rule sits between the digest it sizes and the list, in the split this component draws.
  const { ref, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture } =
    useResizeDrag<HTMLDivElement>((event) => {
      const region = event.currentTarget.previousElementSibling;
      const root = event.currentTarget.parentElement;
      if (!(region instanceof HTMLElement) || root === null) return null;
      const restore = () => region.style.setProperty("max-height", `${height}px`);
      const start = region.offsetHeight;
      return {
        width: start,
        edge: "bottom",
        bounds: { min: MIN_HEIGHT, max: Math.max(MIN_HEIGHT, root.clientHeight - LIST_MIN_HEIGHT) },
        resize(next) {
          region.style.setProperty("max-height", `${next}px`);
          return next;
        },
        // A press without a move keeps the saved height, which may be taller than the digest.
        finish(final, moved) {
          // A drag that ends where it began changes nothing.
          if (!moved || final === start) return restore();
          // Dragging down a digest shorter than the saved height never lowers it.
          const next = Math.round(final > start ? Math.max(final, height) : final);
          setHeight(next);
          region.style.setProperty("max-height", `${next}px`);
        },
        cleanup(committed) {
          if (!committed) restore();
        },
      };
    });
  const file = AsyncResult.getOrElse(result, () => null);
  const sections = file === null || file.exists === false ? [] : parseBotDigest(file.contents);
  const status =
    file === null || file.exists === false ? null : parseBotDigestStatus(file.contents);
  const contents = file === null ? null : file.exists === false ? "" : file.contents;
  const sent = sentFor.contents === contents ? sentFor.answers : NO_ANSWERS;
  const setSent = (
    update: (previous: ReadonlyMap<string, string>) => ReadonlyMap<string, string>,
  ) =>
    setSentFor((previous) => ({
      contents,
      answers: update(previous.contents === contents ? previous.answers : NO_ANSWERS),
    }));
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- when this digest's file changes, forgets dismissals of sections it no longer has, so one that later reads the same again shows; keyed on the file, not on storage, so another window's newer dismissal survives
  useEffect(() => {
    if (contents === null) return;
    const current = new Set(parseBotDigest(contents).map(botDigestSectionKey));
    const stored = readLocalStorageValue(dismissedKey, NO_DISMISSED, DismissedKeys);
    const kept = stored.filter((key) => current.has(key));
    if (kept.length < stored.length) {
      writeLocalStorageValue(dismissedKey, kept, NO_DISMISSED, DismissedKeys);
    }
  }, [contents, dismissedKey]);
  const openThread = useOpenThread();
  if (sections.length === 0 && status === null) {
    return <div className={LIST_CLASS_NAME}>{props.children}</div>;
  }
  const shown = sections.filter(
    (section) => section.kind === "needs-you" || !dismissed.includes(botDigestSectionKey(section)),
  );
  const hiddenCount = sections.length - shown.length;
  const updates = shown.filter((section) => section.kind === "status");
  const updateCount = updates.reduce((count, section) => count + section.items.length, 0);
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
  // A request whose linked thread waits on a question opens that thread to answer it there.
  const reply = (item: BotDigestItem, question: EnvironmentThreadShell | undefined) => {
    if (props.sheet) closeBotThreadsPanel(botRef);
    if (question !== undefined) {
      openThread(scopeThreadRef(question.environmentId, question.id));
      return;
    }
    const store = useComposerDraftStore.getState();
    const existing = store.getComposerDraft(botRef)?.prompt.trimEnd() ?? "";
    const quote = `> ${item.source}\n\n`;
    store.setPrompt(botRef, existing === "" ? quote : `${existing}\n\n${quote}`);
    openThread(botRef);
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Fades the edge the cards run past, so a cut-off card dissolves into the rule. */}
      <ScrollArea
        scrollFade
        className="h-auto shrink"
        style={{ maxHeight: height }}
        data-fork-bot-digest=""
      >
        <div className="flex flex-col gap-2 p-2">
          {status === null ? null : (
            <p
              data-testid="bot-digest-status"
              className="px-1 text-[0.8125rem] leading-5 font-medium text-foreground"
            >
              {status}
            </p>
          )}
          {shown.map((section) =>
            section.kind === "needs-you" ? (
              <BotDigestRequests
                key={section.title}
                section={section}
                botRef={botRef}
                threads={props.threads}
                sent={sent}
                onAnswer={(item, choice) => void answer(item, choice)}
                onReply={reply}
              />
            ) : null,
          )}
          {updates.length === 0 && hiddenCount === 0 ? null : (
            <section className="flex flex-col gap-1">
              <div className="flex h-7 items-center px-1">
                <SidebarV2SectionLabel
                  count={updateCount}
                  collapsed={!updatesOpen}
                  onToggle={() => setUpdatesOpen(!updatesOpen)}
                  testId="bot-digest-updates"
                >
                  Updates
                </SidebarV2SectionLabel>
              </div>
              {updatesOpen ? (
                <>
                  {updates.map((section) => (
                    <BotDigestStatusCard
                      key={section.title}
                      section={section}
                      botRef={botRef}
                      threads={props.threads}
                      onDismiss={() =>
                        setDismissed((stored) => [...stored, botDigestSectionKey(section)])
                      }
                    />
                  ))}
                  {hiddenCount === 0 ? null : (
                    <div className="flex justify-end">
                      <Button
                        size="micro"
                        variant="ghost"
                        onClick={() => setDismissed(NO_DISMISSED)}
                        data-testid="bot-digest-show-dismissed"
                      >
                        Show {hiddenCount} dismissed
                      </Button>
                    </div>
                  )}
                </>
              ) : null}
            </section>
          )}
        </div>
      </ScrollArea>
      <div
        role="separator"
        aria-label="Resize digest"
        aria-orientation="horizontal"
        className="group relative h-px shrink-0 cursor-row-resize touch-none bg-border select-none"
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onLostPointerCapture}
      >
        {/* A taller hit area than the 1px rule, which lights up under the pointer. */}
        <span
          aria-hidden
          className="absolute inset-x-0 -top-1 h-2 any-pointer-coarse:-top-2 any-pointer-coarse:h-4"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px transition-colors duration-150 group-hover:bg-primary/60 group-active:bg-primary/60"
        />
      </div>
      <div className={LIST_CLASS_NAME}>{props.children}</div>
    </div>
  );
}

/** A section's label and count above its cards. */
function BotDigestSectionFrame(props: {
  readonly section: BotDigestSection;
  readonly children: ReactNode;
}) {
  const { section } = props;
  const testId = `bot-digest-${section.title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section className="flex flex-col gap-1" data-testid={`${testId}-card`}>
      <div className="flex h-7 items-center px-1">
        <SidebarV2SectionLabel count={section.items.length} testId={testId}>
          {section.title}
        </SidebarV2SectionLabel>
      </div>
      {props.children}
    </section>
  );
}

/** Drawn as the chat composer by wearing its stamps, so each theme paints it as its composer:
    `prompt` and its `action` in the prompt surface, `children` on the vessel floor beneath. */
function BotDigestComposerFrame(props: {
  readonly prompt: ReactNode;
  readonly action: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <div data-fork-composer-vessel="true" className="flex min-w-0 flex-col rounded-lg">
      <div data-fork-composer-box="true">
        <div data-fork-composer-surface="true" className="flex items-end gap-3 py-2 pr-2 pl-3">
          <div className="min-w-0 flex-1 py-0.5">{props.prompt}</div>
          {props.action}
        </div>
      </div>
      {props.children}
    </div>
  );
}

/** New or In progress: one card, put away with its X. */
function BotDigestStatusCard(props: {
  readonly section: BotDigestSection;
  readonly botRef: ScopedThreadRef;
  readonly threads: BotDigestThreads;
  readonly onDismiss: () => void;
}) {
  const { section } = props;
  const { environmentId } = props.botRef;
  return (
    <BotDigestSectionFrame section={section}>
      <div className={`${CARD_CLASS_NAME} flex items-start gap-2 py-2.5 pr-2 pl-3`}>
        <ul className="flex min-w-0 flex-1 flex-col gap-2">
          {section.items.map((item) => {
            const line = resolveBotDigestLine(item, props.threads, environmentId);
            return (
              <li key={item.source} className="flex flex-col gap-2">
                {line.text === "" ? null : <BotDigestWords text={line.text} />}
                <BotDigestLinkRow
                  links={line.links}
                  environmentId={environmentId}
                  localVisits={props.threads.localVisits}
                />
              </li>
            );
          })}
        </ul>
        <Button
          aria-label={`Dismiss ${section.title}`}
          onClick={props.onDismiss}
          size="icon-micro"
          variant="ghost"
        >
          <XIcon />
        </Button>
      </div>
    </BotDigestSectionFrame>
  );
}

/** Needs you: a card per request, with the short answers it offers (each sent to the bot as the
    reply) and a Reply that quotes it to the bot, or opens the thread it links when that thread
    waits on a question. */
function BotDigestRequests(props: {
  readonly section: BotDigestSection;
  readonly botRef: ScopedThreadRef;
  readonly threads: BotDigestThreads;
  /** The answer each ask was given here; its buttons give way to it. */
  readonly sent: ReadonlyMap<string, string>;
  readonly onAnswer: (item: BotDigestItem, choice: string) => void;
  readonly onReply: (item: BotDigestItem, question: EnvironmentThreadShell | undefined) => void;
}) {
  const { section, botRef } = props;
  return (
    <BotDigestSectionFrame section={section}>
      <ul className="flex flex-col gap-2">
        {section.items.map((item) => {
          const line = resolveBotDigestLine(item, props.threads, botRef.environmentId);
          const given = props.sent.get(item.source);
          return (
            <li key={item.source}>
              <BotDigestComposerFrame
                prompt={
                  <div className="flex flex-col gap-2">
                    {line.text === "" ? null : <BotDigestWords text={line.text} />}
                    {item.answers.length === 0 ? null : given !== undefined ? (
                      <p className="text-xs text-muted-foreground" data-testid="bot-digest-sent">
                        Sent “{given}”
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {item.answers.map((choice) => (
                          <Button
                            key={choice}
                            size="xs"
                            variant="outline"
                            onClick={() => props.onAnswer(item, choice)}
                            data-testid="bot-digest-answer"
                          >
                            {choice}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                }
                action={
                  <Button
                    size="xs"
                    // The answers lead; Reply is for anything else.
                    variant={item.answers.length > 0 && given === undefined ? "ghost" : "default"}
                    onClick={() => props.onReply(item, line.question)}
                    data-testid="bot-digest-reply"
                  >
                    <ReplyIcon />
                    Reply
                  </Button>
                }
              >
                <BotDigestLinkRow
                  className="py-2 pr-2 pl-3"
                  links={line.links}
                  environmentId={botRef.environmentId}
                  localVisits={props.threads.localVisits}
                />
              </BotDigestComposerFrame>
            </li>
          );
        })}
      </ul>
    </BotDigestSectionFrame>
  );
}
