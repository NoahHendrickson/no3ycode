/**
 * A bot's digest at the top of its Threads panel — see `.fork/customizations.yaml#fork-bot-digest`.
 */
import { useAtomValue } from "@effect/atom-react";
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { ProjectReadFileResult, ScopedThreadRef } from "@t3tools/contracts";
import { AsyncResult, Atom } from "effect/reactivity";
import * as Schema from "effect/Schema";
import { XIcon } from "lucide-react";
import { type KeyboardEvent, type PointerEvent, useEffect, useRef } from "react";

import { Button } from "~/components/ui/button";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { cn } from "~/lib/utils";
import { useFilesystemReadAccess } from "~/state/filesystem";
import { projectEnvironment } from "~/state/projects";
import { useQuietThreadShells } from "~/state/entities";
import { revisionedQuery } from "~/state/revisionedQuery";
import { useUiStateStore } from "~/uiStateStore";

import { SidebarV2SectionLabel } from "../SidebarV2SectionLabel";
import { type BotDigestThreads, BotDigestItemRow } from "./BotDigestItem";
import { type BotDigestSection, botDigestSectionKey, parseBotDigest } from "./botDigestSections";
import { BOT_DIGEST_FILE } from "./botSeedFiles";

const NO_DIGEST = Atom.make(AsyncResult.initial<ProjectReadFileResult, never>(false)).pipe(
  Atom.withLabel("bot-digest:none"),
);

const HEIGHT_STORAGE_KEY = "t3code:fork:bot-digest-height";
const DEFAULT_HEIGHT = 240;
const MIN_HEIGHT = 64;
/** What the drag leaves the thread list below it. */
const LIST_MIN_HEIGHT = 96;
const KEYBOARD_STEP = 24;
const StoredHeight = Schema.Finite;
const DismissedKeys = Schema.Array(Schema.String);
const NO_DISMISSED: ReadonlyArray<string> = [];

const CARD_CLASS_NAME = "rounded-lg border border-border bg-card text-card-foreground";

/** What only the owner can settle: it is answered, never put away, and each request is a card. */
const isNeedsYou = (section: BotDigestSection) => /^needs you$/i.test(section.title);

/** The digest's sections with something in them, as cards above the thread list, which a drag
    on the rule below them makes taller or shorter. A dismissed card stays away until the bot
    changes it, and Needs you is never dismissed; nothing draws while the digest is empty or
    unreadable. */
export function BotDigest(props: {
  readonly bot: Pick<EnvironmentThreadShell, "id" | "environmentId" | "worktreePath" | "latestRun">;
}) {
  const { bot } = props;
  const botRef = scopeThreadRef(bot.environmentId, bot.id);
  const threads: BotDigestThreads = {
    shells: useQuietThreadShells(),
    localVisits: useUiStateStore((state) => state.threadLastVisitedAtById),
  };
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
  const file = AsyncResult.getOrElse(result, () => null);
  const sections = file === null || file.exists === false ? [] : parseBotDigest(file.contents);
  if (sections.length === 0) return null;
  const keys = sections.map(botDigestSectionKey);
  const shown = sections.filter(
    (section) => isNeedsYou(section) || !dismissed.includes(botDigestSectionKey(section)),
  );
  const hiddenCount = sections.length - shown.length;
  return (
    <>
      <div
        className="min-h-0 shrink overflow-y-auto"
        style={{ maxHeight: height }}
        data-fork-bot-digest=""
      >
        <div className="flex flex-col gap-2 p-2">
          {shown.map((section) => {
            const key = botDigestSectionKey(section);
            return (
              <BotDigestCard
                key={section.title}
                section={section}
                botRef={botRef}
                threads={threads}
                // Kept only for cards still in the digest, so stale keys fall away on each dismiss.
                onDismiss={
                  isNeedsYou(section)
                    ? null
                    : () => setDismissed([...dismissed.filter((k) => keys.includes(k)), key])
                }
              />
            );
          })}
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
      <BotDigestResizeHandle height={height} onResize={setHeight} />
    </>
  );
}

function BotDigestCard(props: {
  readonly section: BotDigestSection;
  readonly botRef: ScopedThreadRef;
  readonly threads: BotDigestThreads;
  /** Null on a card that cannot be put away. */
  readonly onDismiss: (() => void) | null;
}) {
  const { section } = props;
  const needsYou = isNeedsYou(section);
  const testId = `bot-digest-${section.title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section
      className={needsYou ? "flex flex-col gap-1" : cn(CARD_CLASS_NAME, "px-3 pt-1.5 pb-2.5")}
      data-testid={`${testId}-card`}
    >
      <div className={cn("flex h-7 items-center gap-2", needsYou && "px-1")}>
        <span className="min-w-0 flex-1">
          <SidebarV2SectionLabel count={section.items.length} testId={testId}>
            {section.title}
          </SidebarV2SectionLabel>
        </span>
        {props.onDismiss === null ? null : (
          <Button
            aria-label={`Dismiss ${section.title}`}
            onClick={props.onDismiss}
            size="icon-micro"
            variant="ghost"
          >
            <XIcon />
          </Button>
        )}
      </div>
      <ul className="flex flex-col gap-2">
        {section.items.map((item) => (
          <BotDigestItemRow
            key={item.source}
            item={item}
            botRef={props.botRef}
            threads={props.threads}
            needsYou={needsYou}
            className={needsYou ? cn(CARD_CLASS_NAME, "px-3 py-2.5") : undefined}
          />
        ))}
      </ul>
    </section>
  );
}

interface HeightDrag {
  readonly region: HTMLElement;
  readonly pointerId: number;
  readonly startY: number;
  readonly startHeight: number;
  readonly max: number;
  height: number;
}

function releaseBody() {
  document.body.style.removeProperty("cursor");
  document.body.style.removeProperty("user-select");
}

/** The digest's scroll region, just above its rule. */
function regionAbove(handle: HTMLElement): HTMLElement | null {
  const region = handle.previousElementSibling;
  return region instanceof HTMLElement ? region : null;
}

const clampHeight = (value: number, max: number) =>
  Math.round(Math.max(MIN_HEIGHT, Math.min(max, value)));

/** The tallest the digest can be, leaving the thread list its minimum. */
const maxHeightIn = (handle: HTMLElement) =>
  Math.max(MIN_HEIGHT, (handle.parentElement?.clientHeight ?? 0) - LIST_MIN_HEIGHT);

/** The rule between the digest and the thread list. Dragging it sets the digest's tallest; a
    digest shorter than that keeps its own height, so the drag starts from what is on screen. */
function BotDigestResizeHandle(props: {
  readonly height: number;
  readonly onResize: (height: number) => void;
}) {
  const drag = useRef<HeightDrag | null>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- releases the body-wide drag cursor and selection lock if the panel unmounts mid-drag
  useEffect(
    () => () => {
      if (drag.current !== null) releaseBody();
    },
    [],
  );

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const region = regionAbove(event.currentTarget);
    if (event.button !== 0 || region === null) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const startHeight = region.offsetHeight;
    drag.current = {
      region,
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight,
      max: maxHeightIn(event.currentTarget),
      height: startHeight,
    };
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (active === null || active.pointerId !== event.pointerId) return;
    active.height = clampHeight(active.startHeight + event.clientY - active.startY, active.max);
    active.region.style.maxHeight = `${active.height}px`;
  };
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (active === null || active.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    releaseBody();
    // A press without a move keeps the stored height, which may be taller than the digest.
    if (active.height === active.startHeight) {
      active.region.style.maxHeight = `${props.height}px`;
      return;
    }
    props.onResize(active.height);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const region = regionAbove(event.currentTarget);
    if (region === null || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
    event.preventDefault();
    const step = event.key === "ArrowUp" ? -KEYBOARD_STEP : KEYBOARD_STEP;
    // Up shrinks what is on screen; down raises the saved limit, which a short digest sits under.
    const from = event.key === "ArrowUp" ? region.offsetHeight : props.height;
    props.onResize(clampHeight(from + step, maxHeightIn(event.currentTarget)));
  };

  return (
    <div
      role="separator"
      aria-label="Resize digest"
      aria-orientation="horizontal"
      tabIndex={0}
      className="group relative h-px shrink-0 cursor-row-resize touch-none bg-border outline-none select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
      onKeyDown={onKeyDown}
    >
      {/* A taller hit area than the 1px rule, which lights up under the pointer. */}
      <span
        aria-hidden
        className="absolute inset-x-0 -top-1 h-2 any-pointer-coarse:-top-2 any-pointer-coarse:h-4"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px transition-colors duration-150 group-hover:bg-primary/60 group-focus-visible:bg-primary/60 group-active:bg-primary/60"
      />
    </div>
  );
}
