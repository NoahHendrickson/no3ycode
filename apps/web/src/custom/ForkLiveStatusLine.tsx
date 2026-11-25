/**
 * The one-line live status — see `.fork/customizations.yaml#fork-working-row-last`.
 * The line stays mounted while its group is open, so the toggle keeps focus.
 */
import { ChevronRightIcon } from "lucide-react";
import { useMessages } from "gt-react";
import { forkThinkingWord } from "@t3tools/shared/forkThinkingWords";
import { use, useEffect, useState, type ReactNode } from "react";
import { ActivityShimmerOverlay } from "~/components/chat/TimelineRowParts";
import { TimelineRowActivityCtx, TimelineRowCtx } from "~/components/chat/timelineRowContext";
import { observeVisibleAnimation } from "~/lib/visibleAnimation";
import { SidebarV2WorkingMark } from "./SidebarV2StatusIndicator";
import { ForkLiveTaskList } from "./ForkLiveTaskList";
import { ForkLiveTasksCtx } from "./forkLiveTasks";
import {
  forkStatusLineRotates,
  forkStatusLineStart,
  forkStatusLineStep,
  forkStatusLineVoices,
  type ForkStatusLineRow,
  type ForkStatusLineVoices,
} from "./forkWorkingRowLast";

const BEAT_MS = 4000;

/** Which voice speaks now; forkStatusLineStep holds the rules, this hook the clock. */
function useStatusLineVoice(voices: ForkStatusLineVoices) {
  // Each beat names the arrival it counts from, so a beat queued before an arrival is dropped.
  const [beat, setBeat] = useState({ arrival: 0, count: 0 });
  const [line, setLine] = useState(() => forkStatusLineStart(voices));
  const next = forkStatusLineStep(line, voices, beat);
  if (next !== line) setLine(next);
  const rotates = forkStatusLineRotates(voices);
  const { arrival } = next;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- a wall-clock beat, restarted when something new speaks up
  useEffect(() => {
    if (!rotates) return;
    const id = window.setInterval(
      () => setBeat((previous) => ({ arrival, count: previous.count + 1 })),
      BEAT_MS,
    );
    return () => window.clearInterval(id);
  }, [rotates, arrival]);
  return { voice: next.voice, lap: next.lap };
}

export function ForkLiveStatusLine({
  row,
  timer,
  trailing,
}: {
  row: ForkStatusLineRow;
  timer: ReactNode;
  trailing: ReactNode;
}) {
  const ctx = use(TimelineRowCtx);
  const m = useMessages();
  const live = row.forkLive;
  const groupId = live?.groupId;
  const voices = forkStatusLineVoices(live, use(TimelineRowActivityCtx), ctx.workspaceRoot, m);
  const { voice, lap } = useStatusLineVoice(voices);
  const label =
    voices.pinned ??
    (voice === "tool" ? voices.tool?.label : voice === "thought" ? voices.thought : null) ??
    forkThinkingWord(lap === 0 ? row.forkWordSeed : `${row.forkWordSeed}:${lap}`);
  const text = (
    <>
      <span className="min-w-0 truncate">{label}</span>
      {timer ? <span className="shrink-0">{timer}</span> : null}
    </>
  );
  const content = (
    <>
      <SidebarV2WorkingMark seed={row.id} />
      <span
        ref={observeVisibleAnimation}
        data-fork-status-line
        className="relative flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap"
      >
        {text}
        <ActivityShimmerOverlay className="flex items-center gap-2">{text}</ActivityShimmerOverlay>
      </span>
      {groupId === undefined ? null : (
        <ChevronRightIcon
          aria-hidden
          className={`size-3.5 shrink-0 text-icon-muted ${live?.expanded ? "rotate-90" : ""}`}
        />
      )}
    </>
  );
  const lineClassName =
    "flex h-6 min-w-0 items-center gap-2 px-1 text-left text-sm leading-relaxed text-muted-foreground tabular-nums";
  const tasks = use(ForkLiveTasksCtx);
  const line = (
    <div className="flex min-w-0 items-center gap-2 pb-2 pt-1">
      {groupId === undefined ? (
        <div className={lineClassName}>{content}</div>
      ) : (
        <button
          type="button"
          aria-expanded={live?.expanded === true}
          className={`${lineClassName} cursor-pointer rounded-md hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70`}
          onClick={() => ctx.onToggleWorkGroup(groupId, row.id)}
        >
          {content}
        </button>
      )}
      {trailing}
    </div>
  );
  return tasks === null ? (
    line
  ) : (
    <div className="min-w-0">
      <ForkLiveTaskList steps={tasks} />
      {line}
    </div>
  );
}
