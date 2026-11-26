/**
 * The one-line live status — see `.fork/customizations.yaml#fork-working-row-last`.
 * The line stays mounted while its group is open, so the toggle keeps focus.
 */
import { ChevronRightIcon } from "./icons/lucide-hugeicons";
import { useMessages } from "gt-react";
import { use, useEffect, useState, type ReactNode } from "react";
import { ActivityShimmerOverlay } from "~/components/chat/TimelineRowParts";
import { TimelineRowActivityCtx, TimelineRowCtx } from "~/components/chat/timelineRowContext";
import { observeVisibleAnimation } from "~/lib/visibleAnimation";
import { SidebarV2WorkingMark } from "./SidebarV2StatusIndicator";
import { ForkLiveTaskList } from "./ForkLiveTaskList";
import { ForkLiveTasksCtx } from "./forkLiveTasks";
import {
  forkStatusLineAdvance,
  forkStatusLineDwellEnd,
  forkStatusLineDwellReconcile,
  forkStatusLineDwellStart,
  forkStatusLineReconcile,
  forkStatusLineRotates,
  forkStatusLineStart,
  forkStatusLineText,
  forkStatusLineVoices,
  type ForkStatusLineRow,
  type ForkStatusLineVoices,
} from "./forkWorkingRowLast";

const BEAT_MS = 4000;
const DWELL_MS = 1500;

/**
 * The line swaps a div for a button when a group appears, which remounts the shimmer and
 * would start a sweep at once. Phasing each mount to the clock keeps the sweeps a cycle apart.
 */
function shimmerLineRef(element: HTMLSpanElement | null) {
  const shimmer = element?.querySelector<HTMLElement>(".live-activity-focus");
  const cycleMs = shimmer
    ? Number.parseFloat(getComputedStyle(shimmer).animationDuration) * 1000
    : 0;
  if (element && cycleMs > 0) {
    element.style.setProperty("--fork-shimmer-phase", `${-(performance.now() % cycleMs)}ms`);
  }
  return observeVisibleAnimation(element);
}

/** Holds each new label for DWELL_MS; forkWorkingRowLast holds the rules, this hook only the clock. */
function useDwelledLabel(label: string, thought: boolean): string {
  const [shown, setShown] = useState(() => forkStatusLineDwellStart(label, thought));
  const next = forkStatusLineDwellReconcile(shown, label, thought);
  if (next !== shown) setShown(next);
  const { dwelling, arrival } = next;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- a wall-clock dwell, started by each label that takes the line
  useEffect(() => {
    if (!dwelling) return;
    const id = window.setTimeout(
      () => setShown((current) => forkStatusLineDwellEnd(current, arrival)),
      DWELL_MS,
    );
    return () => window.clearTimeout(id);
  }, [dwelling, arrival]);
  return next.label;
}

/** The rotation's state; forkWorkingRowLast holds the rules, this hook only the clock. */
function useStatusLineState(voices: ForkStatusLineVoices) {
  const [line, setLine] = useState(() => forkStatusLineStart(voices));
  const next = forkStatusLineReconcile(line, voices);
  if (next !== line) setLine(next);
  const rotates = forkStatusLineRotates(voices);
  const { arrival } = next;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- a wall-clock beat, restarted when a voice takes the line
  useEffect(() => {
    if (!rotates) return;
    // A beat queued before a newer arrival is dropped.
    const id = window.setInterval(
      () =>
        setLine((current) =>
          current.arrival === arrival ? forkStatusLineAdvance(current) : current,
        ),
      BEAT_MS,
    );
    return () => window.clearInterval(id);
  }, [rotates, arrival]);
  return next;
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
  const rotation = useStatusLineState(voices);
  const label = useDwelledLabel(
    forkStatusLineText(voices, rotation, row.forkWordSeed),
    voices.pinned === null && rotation.voice === "thought",
  );
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
        ref={shimmerLineRef}
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
