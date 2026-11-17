/**
 * A bot's digest at the top of its Threads panel — see `.fork/customizations.yaml#fork-bot-digest`.
 */
import { useAtomValue } from "@effect/atom-react";
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { ProjectReadFileResult, ScopedThreadRef } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { AsyncResult, Atom } from "effect/reactivity";
import * as Schema from "effect/Schema";
import { ReplyIcon, XIcon } from "lucide-react";
import { type ReactNode, useEffect } from "react";

import { Button } from "~/components/ui/button";
import { useComposerDraftStore } from "~/composerDraftStore";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { useResizeDrag } from "~/hooks/useResizeDrag";
import { useFilesystemReadAccess } from "~/state/filesystem";
import { projectEnvironment } from "~/state/projects";
import { revisionedQuery } from "~/state/revisionedQuery";
import { buildThreadRouteParams } from "~/threadRoutes";

import { SidebarV2SectionLabel } from "../SidebarV2SectionLabel";
import { BotDigestLine, type BotDigestThreads } from "./BotDigestItem";
import {
  type BotDigestItem,
  type BotDigestSection,
  botDigestSectionKey,
  parseBotDigest,
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
const NO_DISMISSED: ReadonlyArray<string> = [];

const CARD_CLASS_NAME = "rounded-lg border border-border bg-card text-card-foreground";
const LIST_CLASS_NAME = "min-h-24 flex-1 overflow-y-auto";

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
  const [dismissed, setDismissed] = useLocalStorage(
    `t3code:fork:bot-digest-dismissed:${scopedThreadKey(botRef)}`,
    NO_DISMISSED,
    DismissedKeys,
  );
  const [height, setHeight] = useLocalStorage(HEIGHT_STORAGE_KEY, DEFAULT_HEIGHT, StoredHeight);
  // The rule sits between the digest it sizes and the list, in the split this component draws.
  const { ref, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture } =
    useResizeDrag<HTMLDivElement>((event) => {
      const region = event.currentTarget.previousElementSibling;
      const root = event.currentTarget.parentElement;
      if (!(region instanceof HTMLElement) || root === null) return null;
      const restore = () => region.style.setProperty("max-height", `${height}px`);
      return {
        width: region.offsetHeight,
        edge: "bottom",
        bounds: { min: MIN_HEIGHT, max: Math.max(MIN_HEIGHT, root.clientHeight - LIST_MIN_HEIGHT) },
        resize(next) {
          region.style.setProperty("max-height", `${next}px`);
          return next;
        },
        // A press without a move keeps the saved height, which may be taller than the digest.
        finish(final, moved) {
          if (moved) setHeight(Math.round(final));
          else restore();
        },
        cleanup(committed) {
          if (!committed) restore();
        },
      };
    });
  const file = AsyncResult.getOrElse(result, () => null);
  const sections = file === null || file.exists === false ? [] : parseBotDigest(file.contents);
  const keys = sections.map(botDigestSectionKey);
  const kept = dismissed.filter((key) => keys.includes(key));
  const forget = file !== null && kept.length < dismissed.length;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- forgets dismissals of sections the bot's latest file no longer has, so one that later reads the same again shows
  useEffect(() => {
    if (forget) setDismissed(kept);
  }, [forget, kept, setDismissed]);
  if (sections.length === 0) {
    return <div className={LIST_CLASS_NAME}>{props.children}</div>;
  }
  const shown = sections.filter(
    (section) => section.kind === "needs-you" || !dismissed.includes(botDigestSectionKey(section)),
  );
  const hiddenCount = sections.length - shown.length;
  const reply = (item: BotDigestItem) => {
    if (props.sheet) closeBotThreadsPanel(botRef);
    const store = useComposerDraftStore.getState();
    const existing = store.getComposerDraft(botRef)?.prompt.trimEnd() ?? "";
    const quote = `> ${item.source}\n\n`;
    store.setPrompt(botRef, existing === "" ? quote : `${existing}\n\n${quote}`);
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="min-h-0 shrink overflow-y-auto"
        style={{ maxHeight: height }}
        data-fork-bot-digest=""
      >
        <div className="flex flex-col gap-2 p-2">
          {shown.map((section) =>
            section.kind === "needs-you" ? (
              <BotDigestRequests
                key={section.title}
                section={section}
                botRef={botRef}
                threads={props.threads}
                onReply={reply}
              />
            ) : (
              <BotDigestStatusCard
                key={section.title}
                section={section}
                botRef={botRef}
                threads={props.threads}
                onDismiss={() => setDismissed([...kept, botDigestSectionKey(section)])}
              />
            ),
          )}
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
        </div>
      </div>
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

function sectionTestId(section: BotDigestSection): string {
  return `bot-digest-${section.title.toLowerCase().replace(/\W+/g, "-")}`;
}

/** New or In progress: one card, put away with its X. */
function BotDigestStatusCard(props: {
  readonly section: BotDigestSection;
  readonly botRef: ScopedThreadRef;
  readonly threads: BotDigestThreads;
  readonly onDismiss: () => void;
}) {
  const { section } = props;
  const testId = sectionTestId(section);
  return (
    <section className={`${CARD_CLASS_NAME} px-3 pt-1.5 pb-2.5`} data-testid={`${testId}-card`}>
      <div className="flex h-7 items-center gap-2">
        <span className="min-w-0 flex-1">
          <SidebarV2SectionLabel count={section.items.length} testId={testId}>
            {section.title}
          </SidebarV2SectionLabel>
        </span>
        <Button
          aria-label={`Dismiss ${section.title}`}
          onClick={props.onDismiss}
          size="icon-micro"
          variant="ghost"
        >
          <XIcon />
        </Button>
      </div>
      <ul className="flex flex-col gap-2">
        {section.items.map((item) => (
          <li key={item.source} className="flex flex-col gap-2">
            <BotDigestLine
              item={item}
              environmentId={props.botRef.environmentId}
              threads={props.threads}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Needs you: its label over a card per request, each with a Reply that quotes it to the bot. */
function BotDigestRequests(props: {
  readonly section: BotDigestSection;
  readonly botRef: ScopedThreadRef;
  readonly threads: BotDigestThreads;
  readonly onReply: (item: BotDigestItem) => void;
}) {
  const { section, botRef } = props;
  const navigate = useNavigate();
  const testId = sectionTestId(section);
  return (
    <section className="flex flex-col gap-1" data-testid={`${testId}-card`}>
      <div className="flex h-7 items-center px-1">
        <SidebarV2SectionLabel count={section.items.length} testId={testId}>
          {section.title}
        </SidebarV2SectionLabel>
      </div>
      <ul className="flex flex-col gap-2">
        {section.items.map((item) => (
          <li key={item.source} className={`${CARD_CLASS_NAME} flex flex-col gap-2 px-3 py-2.5`}>
            <BotDigestLine
              item={item}
              environmentId={botRef.environmentId}
              threads={props.threads}
              action={
                <Button
                  size="xs"
                  onClick={() => {
                    props.onReply(item);
                    void navigate({
                      to: "/$environmentId/$threadId",
                      params: buildThreadRouteParams(botRef),
                    });
                  }}
                  data-testid="bot-digest-reply"
                >
                  <ReplyIcon />
                  Reply
                </Button>
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
