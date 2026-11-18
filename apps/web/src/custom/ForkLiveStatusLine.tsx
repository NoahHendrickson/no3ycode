/**
 * The one-line live status — see `.fork/customizations.yaml#fork-working-row-last`.
 * The line stays mounted while its group is open, so the toggle keeps focus.
 */
import { ChevronRightIcon } from "lucide-react";
import { use, type ReactNode } from "react";
import { liveWorkEntryLabel } from "~/components/chat/MessagesTimeline.logic";
import {
  TimelineRowActivityCtx,
  TimelineRowCtx,
  type TimelineRow,
} from "~/components/chat/timelineRowContext";
import { threadReadLabel, useThreadReadTarget } from "~/components/chat/TimelineWorkEntryRow";
import { SidebarV2WorkingMark } from "./SidebarV2StatusIndicator";
import type { ForkLiveRow } from "./forkWorkingRowLast";

function ThinkingLabel() {
  const { liveAnswerPreview, providerStartingLabel } = use(TimelineRowActivityCtx);
  return providerStartingLabel ?? liveAnswerPreview ?? "Thinking";
}

function WorkLabel({ row }: { row: Extract<ForkLiveRow, { kind: "work-live" }> }) {
  const ctx = use(TimelineRowCtx);
  const target = useThreadReadTarget(row.entry, ctx.activeThreadEnvironmentId);
  if (row.entry.itemType === "reasoning" || row.entry === row.thought) return "Thinking";
  const label = liveWorkEntryLabel(row.entry, ctx.workspaceRoot, true);
  return threadReadLabel(label, target)?.text ?? label;
}

export function ForkLiveStatusLine({
  row,
  live,
  timer,
  trailing,
}: {
  row: Extract<TimelineRow, { kind: "working" }>;
  live: ForkLiveRow;
  timer: ReactNode;
  trailing: ReactNode;
}) {
  const ctx = use(TimelineRowCtx);
  const groupId = live.groupId;
  const content = (
    <>
      <SidebarV2WorkingMark seed={row.id} />
      <span className="min-w-0 truncate">
        {live.kind === "thinking" ? <ThinkingLabel /> : <WorkLabel row={live} />}
      </span>
      {timer ? <span className="shrink-0">· {timer}</span> : null}
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
