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
  forkStatusLineCycle,
  forkStatusLineLead,
  forkStatusLineVoice,
  forkStatusLineVoices,
  type ForkStatusLineRow,
  type ForkStatusLineVoices,
  type ForkStatusVoice,
} from "./forkWorkingRowLast";

const BEAT_MS = 4000;

/** Which voice speaks now: a new tool or thought at once, then a turn each per beat. */
function useStatusLineVoice(voices: ForkStatusLineVoices) {
  const toolKey = voices.tool?.key ?? null;
  const [seen, setSeen] = useState(() => ({
    toolKey,
    thought: voices.thought,
    lead: (toolKey !== null ? "tool" : "thought") as ForkStatusVoice,
    arrival: 0,
  }));
  if (seen.toolKey !== toolKey || seen.thought !== voices.thought) {
    setSeen({
      toolKey,
      thought: voices.thought,
      lead: forkStatusLineLead(seen, voices, seen.lead),
      arrival: seen.arrival + 1,
    });
  }
  const cycle = forkStatusLineCycle(voices);
  const rotates = cycle.length > 1;
  const [clock, setClock] = useState({ arrival: 0, beats: 0 });
  const beats = clock.arrival === seen.arrival ? clock.beats : 0;
  const { arrival } = seen;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- a wall-clock beat, restarted when something new speaks up
  useEffect(() => {
    if (!rotates) return;
    const id = window.setInterval(
      () =>
        setClock((previous) => ({
          arrival,
          beats: (previous.arrival === arrival ? previous.beats : 0) + 1,
        })),
      BEAT_MS,
    );
    return () => window.clearInterval(id);
  }, [rotates, arrival]);
  return {
    voice: forkStatusLineVoice(cycle, seen.lead, beats),
    // A fresh word each lap; with nothing else to say it holds until something lands.
    lap: Math.floor(beats / cycle.length),
  };
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
