/**
 * The one-line live status — see `.fork/customizations.yaml#fork-working-row-last`.
 * The line stays mounted while its group is open, so the toggle keeps focus.
 */
import { useMessages } from "gt-react";
import { ChevronRightIcon } from "lucide-react";
import { use, type ReactNode } from "react";
import { liveWorkEntryLabel } from "~/components/chat/MessagesTimeline.logic";
import { TimelineRowActivityCtx, TimelineRowCtx } from "~/components/chat/timelineRowContext";
import { threadReadLabel, useThreadReadTarget } from "~/components/chat/TimelineWorkEntryRow";
import { toServerClock } from "@t3tools/client-runtime/clock";
import { tickTextContent } from "~/lib/tickTextContent";
import { SidebarV2WorkingMark } from "./SidebarV2StatusIndicator";
import { forkThinkingWord } from "./forkThinkingWords";
import {
  forkStatusLineLabel,
  type ForkLiveRow,
  type ForkStatusLineRow,
} from "./forkWorkingRowLast";

// Ticks through the DOM like the turn timer, so a word change never re-renders the row.
function ThinkingWord({ startedAt }: { startedAt: string }) {
  const { activeThreadEnvironmentId } = use(TimelineRowCtx);
  return (
    <span
      ref={tickTextContent(
        (nowMs) => forkThinkingWord(startedAt, toServerClock(activeThreadEnvironmentId, nowMs)),
        true,
      )}
    />
  );
}

function WorkStatusLabel({
  live,
  startedAt,
}: {
  live: Extract<ForkLiveRow, { kind: "work-live" }>;
  startedAt: string;
}) {
  const ctx = use(TimelineRowCtx);
  const activity = use(TimelineRowActivityCtx);
  const target = useThreadReadTarget(live.entry, ctx.activeThreadEnvironmentId);
  const messages = useMessages();
  const toolLabel = liveWorkEntryLabel(live.entry, ctx.workspaceRoot, true, messages);
  return (
    forkStatusLineLabel(
      live,
      activity,
      threadReadLabel(toolLabel, live.entry, target, messages)?.text ?? toolLabel,
    ) ?? <ThinkingWord startedAt={startedAt} />
  );
}

function StatusLabel({ live, startedAt }: { live: ForkLiveRow; startedAt: string }) {
  const activity = use(TimelineRowActivityCtx);
  return live.kind === "work-live" ? (
    <WorkStatusLabel live={live} startedAt={startedAt} />
  ) : (
    (forkStatusLineLabel(live, activity, "") ?? <ThinkingWord startedAt={startedAt} />)
  );
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
  const live = row.forkLive;
  const groupId = live.groupId;
  const content = (
    <>
      <SidebarV2WorkingMark seed={row.id} />
      <span className="min-w-0 truncate">
        <StatusLabel live={live} startedAt={row.createdAt ?? ""} />
      </span>
      {timer ? (
        <>
          <span aria-hidden className="size-[3px] shrink-0 rounded-full bg-current" />
          <span className="shrink-0">{timer}</span>
        </>
      ) : null}
      {groupId === undefined ? null : (
        <ChevronRightIcon
          aria-hidden
          className={`size-3.5 shrink-0 text-icon-muted ${live.expanded ? "rotate-90" : ""}`}
        />
      )}
    </>
  );
  const lineClassName =
    "flex h-6 min-w-0 items-center gap-2 px-1 text-left text-sm leading-relaxed text-muted-foreground tabular-nums";
  return (
    <div className="flex min-w-0 items-center gap-2 pb-2 pt-1">
      {groupId === undefined ? (
        <div className={lineClassName}>{content}</div>
      ) : (
        <button
          type="button"
          aria-expanded={live.expanded === true}
          className={`${lineClassName} cursor-pointer rounded-md hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70`}
          onClick={() => ctx.onToggleWorkGroup(groupId, row.id)}
        >
          {content}
        </button>
      )}
      {trailing}
    </div>
  );
}
