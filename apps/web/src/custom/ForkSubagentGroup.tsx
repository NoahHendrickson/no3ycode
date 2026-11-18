/**
 * The transcript's subagents as cards (Basic UI kit, Figma 89:704) — see
 * `.fork/customizations.yaml#fork-subagent-spawn-card`.
 *
 * Every subagent, alone or in a batch, renders here in place of upstream's
 * lifecycle row and `V2SubagentGroup`. A batch keeps its list-tree lead line
 * ("Kicked off N subagents", the status summary and the batch's elapsed span)
 * above one card per member. A card is a header (the provider's mark in a tile
 * with the status mark in its corner, the title over the status word, the
 * elapsed time, an open-thread button, a chevron) and a well underneath: the task it was given, what
 * it is doing now or what it found, and the model. The well starts open while
 * the subagent works and folds once it settles, unless the chevron was used.
 * The arrow button, and the header itself, open the subagent's thread when it has one.
 *
 * Status comes from the thread's live subagent roster where the projection
 * keeps it current, falling back to the item's own fields for settled
 * history. Elapsed timers self-tick through `AgentElapsed`'s DOM writes.
 */
import { useAtomValue } from "@effect/atom-react";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpRightIcon, ChevronRightIcon, ListTreeIcon } from "lucide-react";
import { type CSSProperties, Fragment, memo, type ReactNode, use, useId, useState } from "react";

import { AgentElapsed } from "~/components/chat/AgentElapsed";
import type { MessagesTimelineRow } from "~/components/chat/MessagesTimeline.logic";
import { TimelineRowCtx } from "~/components/chat/timelineRowContext";
import { EnvironmentSubagentAvatar } from "~/components/chat/V2LifecycleRow";
import { WorkLogBlock } from "~/components/chat/WorkLog";
import { MiddleTruncate } from "~/components/ui/middle-truncate";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { useEnvironment } from "~/state/environments";
import { environmentThreadDetails } from "~/state/threads";
import { buildThreadRouteParams } from "~/threadRoutes";

import { ForkProviderMark, hasForkProviderMark } from "./icons/ModelPickerProviderGlyph";
import {
  forkSubagentMembers,
  formatForkSubagentModel,
  resolveForkSubagentTree,
  type ForkSubagentItem,
  type ForkSubagentMark,
  type ForkSubagentTreeRow,
} from "./forkSubagentTree";
import { SidebarV2StatusMark, type SidebarV2TopStatusMark } from "./SidebarV2StatusIndicator";

type EventRow = Extract<MessagesTimelineRow, { readonly kind: "event" }>;

/** Every subagent of the row renders as a card in one keyed list, so a lone card that gains a
    neighbour stays mounted (and keeps focus) as the batch's lead line appears above it. */
export const ForkSubagentGroup = memo(function ForkSubagentGroup(props: {
  readonly row: EventRow;
  readonly environmentId: EnvironmentId;
  readonly onOpenThread: (threadId: ThreadId) => void;
}) {
  const { row, environmentId, onOpenThread } = props;
  const members = forkSubagentMembers(row);
  const leadId = useId();
  const [first] = members;
  if (first === undefined) return null;
  const batch = members.length > 1;
  return (
    <WorkLogBlock continues={row.continuesWorkLog}>
      <div
        data-fork-subagent-tree=""
        data-subagent-group
        role="group"
        aria-labelledby={leadId}
        className="flex w-full min-w-0 flex-col items-start gap-2 py-1 text-sm leading-5"
      >
        {batch ? (
          <SubagentBatchLead id={leadId} members={members} environmentId={environmentId} />
        ) : null}
        {members.map((item) => (
          <LiveSubagentCard
            key={item.id}
            item={item}
            titleId={batch ? undefined : leadId}
            anchorKey={row.id}
            environmentId={environmentId}
            onOpenThread={onOpenThread}
          />
        ))}
      </div>
    </WorkLogBlock>
  );
});

/** One card. It selects only its own agent, so another subagent's progress does not re-render it. */
const LiveSubagentCard = memo(function LiveSubagentCard(props: {
  readonly item: ForkSubagentItem;
  /** A lone card's visible title names its group. */
  readonly titleId?: string | undefined;
  readonly anchorKey: string;
  readonly environmentId: EnvironmentId;
  readonly onOpenThread: (threadId: ThreadId) => void;
}) {
  const { item, titleId, anchorKey, environmentId, onOpenThread } = props;
  const live = useAtomValue(
    environmentThreadDetails.threadAtom(scopeThreadRef(environmentId, item.threadId)),
    (thread) => thread?.projection.subagents.find((agent) => agent.id === item.subagentId) ?? null,
  );
  const [member] = resolveForkSubagentTree([item], live ? [live] : null).rows;
  if (member === undefined) return null;
  return (
    <ForkSubagentCard
      member={member}
      titleId={titleId}
      anchorKey={anchorKey}
      environmentId={environmentId}
      onOpenThread={onOpenThread}
    />
  );
});

/** A batch's lead line: "Kicked off N subagents", the status summary and the batch's span,
    from the thread's live roster. */
function SubagentBatchLead(props: {
  readonly id: string;
  readonly members: ReadonlyArray<ForkSubagentItem>;
  readonly environmentId: EnvironmentId;
}) {
  const { id, members, environmentId } = props;
  const liveAgents = useAtomValue(
    environmentThreadDetails.threadAtom(scopeThreadRef(environmentId, members[0]!.threadId)),
    (thread) => thread?.projection.subagents,
  );
  const tree = resolveForkSubagentTree(members, liveAgents);
  return (
    <span className="flex w-full min-w-0 items-start gap-2 pb-1">
      <span aria-hidden className="flex size-4 shrink-0 items-center py-px">
        <ListTreeIcon weight="stroke" className="size-4 text-foreground" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col items-start">
        <span id={id} className="w-full min-w-0 truncate text-foreground">
          {tree.lead}
        </span>
        <span className="flex min-w-0 items-start gap-3 whitespace-nowrap text-muted-foreground">
          <span>{tree.summary}</span>
          {tree.timing ? (
            <span className="tabular-nums">
              <AgentElapsed agent={tree.timing} />
            </span>
          ) : null}
        </span>
      </span>
    </span>
  );
}

/** Opens a subagent's thread: its child thread here, or the thread a linked environment runs it
    in when this client is connected there; null when there is nowhere to go. Mirrors upstream's
    SubagentLifecycleRow (V2LifecycleRow.tsx), which the card replaces. */
function useOpenSubagentThread(
  member: Pick<ForkSubagentTreeRow, "childThreadId" | "remote">,
  onOpenThread: (threadId: ThreadId) => void,
): (() => void) | null {
  const { childThreadId, remote } = member;
  const remoteEnvironment = useEnvironment(remote?.environmentId ?? null);
  const navigate = useNavigate();
  if (childThreadId !== null) return () => onOpenThread(childThreadId);
  if (remote === undefined || remoteEnvironment === null) return null;
  return () =>
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(scopeThreadRef(remote.environmentId, remote.threadId)),
    });
}

function ForkSubagentCard(props: {
  readonly member: ForkSubagentTreeRow;
  readonly titleId?: string | undefined;
  /** The timeline row, which keeps its scroll position while a card opens or folds. */
  readonly anchorKey: string;
  readonly environmentId: EnvironmentId;
  readonly onOpenThread: (threadId: ThreadId) => void;
}) {
  const { member, titleId, anchorKey, environmentId, onOpenThread } = props;
  // The chevron's choice lives in the thread's timeline view state, so it survives the row
  // scrolling out of the virtualised list or its turn folding.
  const ctx = use(TimelineRowCtx);
  const chosen = ctx.workGroupViewState.expandedEntries;
  const openKey = `subagent-card:open:${member.id}`;
  const closedKey = `subagent-card:closed:${member.id}`;
  const [chosenOpen, setChosenOpen] = useState<boolean | null>(() =>
    chosen.has(openKey) ? true : chosen.has(closedKey) ? false : null,
  );
  const open = chosenOpen ?? member.mark === "working";
  const toggle = () => {
    // The card is the reveal target, not the whole batch row (MessagesTimeline's data-work-entry-id).
    ctx.onToggleWorkEntry(anchorKey, open, member.id);
    // Its details are already in hand, so opening is ready at once; that retires the reveal
    // instead of re-running it on every later list resize.
    if (!open) ctx.onWorkEntryContentReady?.(anchorKey, member.id);
    chosen.delete(open ? openKey : closedKey);
    chosen.add(open ? closedKey : openKey);
    setChosenOpen(!open);
  };
  const openThread = useOpenSubagentThread(member, onOpenThread);
  return (
    <ForkSubagentCardView
      member={member}
      titleId={titleId}
      environmentId={environmentId}
      open={open}
      onToggle={toggle}
      openThread={openThread}
    />
  );
}

/** @public — the card as drawn, without the timeline's state; Storybook renders it on its own. */
export function ForkSubagentCardView(props: {
  readonly member: ForkSubagentTreeRow;
  readonly titleId?: string | undefined;
  readonly environmentId: EnvironmentId;
  readonly open: boolean;
  readonly onToggle: () => void;
  /** Null when the subagent has no thread to open. */
  readonly openThread: (() => void) | null;
}) {
  const { member, titleId, environmentId, open, onToggle, openThread } = props;
  const wellId = useId();
  const remote = member.remote;
  const failed = member.mark === "failed";
  const model = formatForkSubagentModel(member.model);
  // One list of rows: a subagent that has only just started can have none yet, and then the card
  // offers no chevron and no well.
  const details: Array<{ readonly term: string; readonly detail: ReactNode }> = [];
  if (member.prompt) {
    details.push({
      term: "Task",
      detail: <dd className="line-clamp-2 text-foreground">{member.prompt}</dd>,
    });
  }
  if (member.activity) {
    details.push({
      term: member.activity.label,
      detail: (
        <dd className={cn("min-w-0", failed ? "text-sidebar-v2-status-failed" : "text-foreground")}>
          {member.activity.shape === "path" ? (
            <MiddleTruncate value={member.activity.text} showTitle={false} className="flex" />
          ) : (
            <span className="line-clamp-3">{member.activity.text}</span>
          )}
        </dd>
      ),
    });
  }
  if (model) {
    details.push({ term: "Model", detail: <dd className="truncate text-foreground">{model}</dd> });
  }
  const identity = (
    <>
      <span
        aria-hidden
        className="relative flex size-8 shrink-0 items-center justify-center rounded-[4px] border border-border bg-accent"
      >
        {/* A linked environment's task names its driver only as a label; the avatar resolves the
            provider that really runs it there. */}
        {remote === undefined && hasForkProviderMark(member.driver) ? (
          <>
            <span className="flex" style={MARK_SIZE}>
              <ForkProviderMark driver={member.driver} />
            </span>
            {/* As the model picker does: the resolved avatar over the mark, glyph hidden, draws
                the instance badge alone when shouldShowInstanceBadge asks for one, in the corner
                the status mark leaves free. */}
            <EnvironmentSubagentAvatar
              environmentId={environmentId}
              providerInstanceId={member.providerInstanceId}
              driver={member.driver}
              className="absolute inset-0 size-auto rounded-none border-0 bg-transparent ring-0"
              providerIconClassName="absolute inset-0"
              iconClassName="hidden"
              badgeClassName="top-[-0.3125rem] right-[-0.3125rem] bottom-auto h-3 min-w-3 px-0.5 text-5xs"
            />
          </>
        ) : (
          <EnvironmentSubagentAvatar
            environmentId={environmentId}
            providerInstanceId={member.providerInstanceId}
            driver={member.driver}
            remote={remote}
            className="size-5 rounded-none border-0 bg-transparent ring-0"
            iconClassName="size-5"
          />
        )}
        <span className="absolute -right-0.5 -bottom-0.5 flex size-3.5 items-center justify-center rounded-full bg-card">
          <span className="flex scale-75 items-center justify-center">
            <SidebarV2StatusMark status={markStatus(member.mark)} seed={member.id} idle="dot" />
          </span>
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col items-start">
        <span
          id={titleId}
          className="w-full min-w-0 truncate text-sm leading-4 font-medium text-foreground"
        >
          {member.title}
        </span>
        <span
          className={cn(
            "w-full min-w-0 truncate text-sm leading-4",
            failed ? "text-sidebar-v2-status-failed" : "text-muted-foreground",
          )}
        >
          {member.statusLabel}
          {remote !== undefined ? ` · on ${remote.label}` : null}
        </span>
      </span>
      {member.startedAt ? (
        <span className="shrink-0 text-xs font-medium text-foreground tabular-nums">
          <AgentElapsed agent={member} />
        </span>
      ) : null}
    </>
  );
  return (
    <div
      data-fork-subagent-card=""
      data-work-entry-id={member.id}
      className="w-full min-w-0 overflow-clip rounded-[8px] border border-border bg-card"
    >
      <div className="flex min-h-14 items-center gap-2 px-3 py-2">
        {openThread === null ? (
          <span className="flex min-w-0 flex-1 items-center gap-2">{identity}</span>
        ) : (
          <button
            type="button"
            data-fork-subagent-member=""
            aria-label={`Open ${member.title}`}
            aria-description={
              remote !== undefined
                ? `${member.statusLabel} · on ${remote.label}`
                : member.statusLabel
            }
            onClick={openThread}
            className="-m-1 flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70"
          >
            {identity}
          </button>
        )}
        {openThread === null ? null : (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  data-fork-subagent-open=""
                  aria-label={`Open ${member.title} thread`}
                  onClick={openThread}
                  className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[8px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70"
                />
              }
            >
              <ArrowUpRightIcon aria-hidden className="size-3.5" />
            </TooltipTrigger>
            <TooltipPopup side="top">Open thread</TooltipPopup>
          </Tooltip>
        )}
        {details.length === 0 ? null : (
          <button
            type="button"
            data-fork-subagent-toggle=""
            aria-expanded={open}
            aria-controls={wellId}
            aria-label={open ? `Hide ${member.title} details` : `Show ${member.title} details`}
            onClick={onToggle}
            className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[8px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70"
          >
            <ChevronRightIcon className={cn("size-3", open && "rotate-90")} />
          </button>
        )}
      </div>
      {details.length === 0 ? null : (
        <dl
          id={wellId}
          hidden={!open}
          data-fork-subagent-well=""
          className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-t-[7px] bg-[var(--fork-composer-bg)] px-3 py-2 text-xs leading-[18px] shadow-[inset_0_1px_0_var(--color-border)]"
        >
          {details.map(({ term, detail }) => (
            <Fragment key={term}>
              <dt className="text-muted-foreground">{term}</dt>
              {detail}
            </Fragment>
          ))}
        </dl>
      )}
    </div>
  );
}

/** The tile's provider mark, as the model picker draws Codex's and Claude's (Figma 89:704). */
const MARK_SIZE = { "--fork-mark-size": "1.25rem" } as CSSProperties;

/** The sidebar's mark set by the card's vocabulary. Idle and stopped both
    settle on the hollow idle circle: nothing pending, nothing to report. */
function markStatus(mark: ForkSubagentMark): SidebarV2TopStatusMark | null {
  switch (mark) {
    case "working":
      return { label: "Working", mark: "working" };
    case "done":
      return { label: "Completed", mark: "dot", tone: "done" };
    case "failed":
      return { label: "Failed", mark: "dot", tone: "failed" };
    case "idle":
    case "stopped":
      return null;
    default: {
      const exhaustive: never = mark;
      return exhaustive;
    }
  }
}
