/**
 * The transcript's subagents as cards (Basic UI kit, Figma 89:704) — see
 * `.fork/customizations.yaml#fork-subagent-spawn-card`.
 *
 * Every subagent, alone or in a batch, renders here in place of upstream's
 * lifecycle row and `V2SubagentGroup`. A batch keeps its list-tree lead line
 * ("Kicked off N subagents", the status summary and the batch's elapsed span)
 * above one card per member. A card is a header (the provider's mark in a tile
 * with the status mark in its corner, the title over the model and effort, the
 * elapsed time, a chevron, an open-thread arrow) and a well underneath: the task it was given, what
 * it is doing now or what it found. The well starts folded; the header strip, chevron included,
 * opens and folds it, and the arrow opens the thread.
 *
 * Status comes from the thread's live subagent roster where the projection
 * keeps it current, falling back to the item's own fields for settled
 * history. Elapsed timers self-tick through `AgentElapsed`'s DOM writes.
 */
import { useAtomValue } from "@effect/atom-react";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import {
  formatSubagentDisplayTitle,
  resolveSubagentMetadata,
} from "@t3tools/client-runtime/state/subagent-display";
import { formatSubagentEffort } from "@t3tools/client-runtime/state/thread-execution";
import type { SideThreadOpenIntent } from "@t3tools/client-runtime/side-thread";
import type { EnvironmentId, ScopedThreadRef, ThreadId } from "@t3tools/contracts";
import { ArrowUpRightIcon, ChevronDownIcon, ListTreeIcon } from "lucide-react";
import {
  type ComponentProps,
  type CSSProperties,
  Fragment,
  memo,
  type ReactNode,
  use,
  useId,
  useState,
} from "react";

import { AgentElapsed } from "~/components/chat/AgentElapsed";
import type { MessagesTimelineRow } from "~/components/chat/MessagesTimeline.logic";
import { TimelineRowCtx, WorkGroupViewCtx } from "~/components/chat/timelineRowContext";
import { SideThreadsOpenContext, useSideThreadTrigger } from "~/hooks/useSideThreadTrigger";
import { useLinkedThreadOpener } from "~/state/linkedThreadView";
import {
  EnvironmentSubagentAvatar,
  SubagentNotificationLink,
} from "~/components/chat/V2LifecycleRow";
import { subagentResumedSince } from "~/components/chat/V2LifecycleRow.logic";
import { WorkLogBlock } from "~/components/chat/WorkLog";
import { Button } from "~/components/ui/button";
import { MiddleTruncate } from "~/components/ui/middle-truncate";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { serverEnvironment } from "~/state/server";
import { useQuietThreadShell } from "~/state/entities";
import { environmentThreadDetails } from "~/state/threads";

import { ForkProviderMark, hasForkProviderMark } from "./icons/ModelPickerProviderGlyph";
import {
  forkSubagentMembers,
  forkSubagentRowFromAgent,
  formatForkSubagentModel,
  resolveForkSubagentTree,
  type ForkSubagentItem,
  type ForkSubagentMark,
  type ForkSubagentTreeRow,
} from "./forkSubagentTree";
import { SidebarV2StatusMark, type SidebarV2TopStatusMark } from "./SidebarV2StatusIndicator";

type EventRow = Extract<MessagesTimelineRow, { readonly kind: "event" }>;
/** MessagesTimeline's opener: the click's intent opens a subagent beside the thread or in its place. */
type OpenThread = (
  threadId: ThreadId,
  environmentId?: EnvironmentId,
  intent?: SideThreadOpenIntent,
) => void;

/** Every subagent of the row renders as a card in one keyed list, so a lone card that gains a
    neighbour stays mounted (and keeps focus) as the batch's lead line appears above it. */
export const ForkSubagentGroup = memo(function ForkSubagentGroup(props: {
  readonly row: EventRow;
  readonly environmentId: EnvironmentId;
  readonly onOpenThread: OpenThread;
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
  readonly onOpenThread: OpenThread;
}) {
  const { item, titleId, anchorKey, environmentId, onOpenThread } = props;
  const live = useAtomValue(
    environmentThreadDetails.threadAtom(scopeThreadRef(environmentId, item.threadId)),
    (thread) => thread?.projection.subagents.find((agent) => agent.id === item.subagentId) ?? null,
  );
  // The chevron's choice lives in the thread's timeline view state, so it survives the row
  // scrolling out of the virtualised list or its turn folding.
  const ctx = use(TimelineRowCtx);
  const [member] = resolveForkSubagentTree([item], live ? [live] : null).rows;
  if (member === undefined) return null;
  const chosen = ctx.workGroupViewState.expandedEntries;
  const openKey = `subagent-card:open:${member.id}`;
  return (
    <ForkSubagentCard
      member={member}
      titleId={titleId}
      environmentId={environmentId}
      parentRef={scopeThreadRef(environmentId, item.threadId)}
      onOpenThread={onOpenThread}
      disclosure={{
        open: chosen.has(openKey),
        remember: (open) => (open ? chosen.add(openKey) : chosen.delete(openKey)),
        // The card is the reveal target, not the whole batch row (MessagesTimeline's data-work-entry-id).
        report: (collapsed) => ctx.onToggleWorkEntry(anchorKey, collapsed, member.id),
        ready: () => ctx.onWorkEntryContentReady?.(anchorKey, member.id),
      }}
    />
  );
});

/** A subagent's completion notice drawn as its card, folded, with the result it reported. A
    question or progress notice, or one whose agent has resumed since, keeps upstream's row. */
export function ForkSubagentNotice(
  props: ComponentProps<typeof SubagentNotificationLink> & {
    readonly entryId: string;
    readonly onToggleEntry?: ((collapsed: boolean) => void) | undefined;
    readonly onContentReady?: (() => void) | undefined;
  },
) {
  const { entryId, onToggleEntry, onContentReady, ...notice } = props;
  const { parentRef, childThreadId, taskIds, outcome } = notice;
  // Follow-up tasks share a child conversation; the notice reports one task's result.
  const agent = useAtomValue(
    environmentThreadDetails.threadAtom(parentRef),
    (thread) =>
      thread?.projection.subagents.find((candidate) =>
        taskIds === undefined
          ? candidate.childThreadId === childThreadId
          : taskIds.includes(candidate.id),
      ) ?? null,
  );
  const ctx = use(TimelineRowCtx);
  // Inside an expanded tool-call group the entry reports to the group, as upstream's rows do.
  const groupView = use(WorkGroupViewCtx);
  if (agent === null) return notice.fallback;
  const settled = outcome === "completed" || outcome === "failed" || outcome === "cancelled";
  if (!settled || subagentResumedSince(agent, notice.createdAt)) {
    return <SubagentNotificationLink {...notice} />;
  }
  const chosen = groupView?.state.expandedEntries ?? ctx.workGroupViewState.expandedEntries;
  return (
    <ForkSubagentCard
      member={forkSubagentRowFromAgent(agent)}
      environmentId={parentRef.environmentId}
      parentRef={parentRef}
      onOpenThread={notice.onOpenThread}
      disclosure={{
        open: chosen.has(entryId),
        remember: (open) => (open ? chosen.add(entryId) : chosen.delete(entryId)),
        report: (collapsed) =>
          groupView ? groupView.onToggleEntry(collapsed, entryId) : onToggleEntry?.(collapsed),
        ready: () => (groupView ? groupView.onContentReady?.(entryId) : onContentReady?.()),
      }}
    />
  );
}

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
  member: Pick<ForkSubagentTreeRow, "childThreadId" | "remote" | "title">,
  parentRef: ScopedThreadRef,
  onOpenThread: OpenThread,
): {
  readonly open: ((intent: SideThreadOpenIntent) => void) | null;
  /** A task on a connected linked environment opens there, on the main screen only. */
  readonly panel: boolean;
} {
  const { childThreadId, remote } = member;
  // A task in a linked environment opens there, or read-only through this one.
  const remoteOpener = useLinkedThreadOpener(parentRef, remote, member.title);
  const canOpen = use(SideThreadsOpenContext);
  const panel = childThreadId !== null || remoteOpener?.mode === "linked";
  if (!canOpen) return { open: null, panel };
  if (childThreadId !== null)
    return { open: (intent) => onOpenThread(childThreadId, undefined, intent), panel };
  return { open: remoteOpener?.open ?? null, panel };
}

/** Where a card keeps whether it is open and tells the timeline it opened or folded. */
interface ForkSubagentCardDisclosure {
  /** Open before a remount; a card starts folded. */
  readonly open: boolean;
  readonly remember: (open: boolean) => void;
  /** Keeps the timeline's scroll position while the card opens or folds. */
  readonly report: (collapsed: boolean) => void;
  /** Its details are already in hand, so opening is ready at once; that retires the reveal
      instead of re-running it on every later list resize. */
  readonly ready: () => void;
}

function ForkSubagentCard(props: {
  readonly member: ForkSubagentTreeRow;
  readonly titleId?: string | undefined;
  readonly environmentId: EnvironmentId;
  /** The thread the subagent runs under; a linked environment's task opens through it. */
  readonly parentRef: ScopedThreadRef;
  readonly onOpenThread: OpenThread;
  readonly disclosure: ForkSubagentCardDisclosure;
}) {
  const { member, titleId, environmentId, parentRef, onOpenThread, disclosure } = props;
  const [open, setOpen] = useState(disclosure.open);
  const toggle = () => {
    disclosure.report(open);
    if (!open) disclosure.ready();
    disclosure.remember(!open);
    setOpen(!open);
  };
  const opener = useOpenSubagentThread(member, parentRef, onOpenThread);
  // An untitled subagent (a completion notice's record often is) takes its child thread's title,
  // which is generated from the ask; the model falls back to the ask itself.
  const childTitle = useQuietThreadShell(
    !member.titled && member.childThreadId !== null
      ? scopeThreadRef(environmentId, member.childThreadId)
      : null,
  )?.source.title;
  const effort = useForkSubagentEffort(member, environmentId);
  return (
    <ForkSubagentCardView
      member={childTitle ? { ...member, title: formatSubagentDisplayTitle(childTitle) } : member}
      effort={effort}
      titleId={titleId}
      environmentId={environmentId}
      open={open}
      onToggle={toggle}
      openThread={opener.open}
      openInPanel={opener.panel}
    />
  );
}

/** The reasoning effort a subagent runs at, in the picker's words; null when none is reported.
    Selected down to the label, so a provider update re-renders only the cards whose effort changed. */
export function useForkSubagentEffort(
  member: Pick<ForkSubagentTreeRow, "model" | "modelSelection" | "providerInstanceId">,
  environmentId: EnvironmentId,
): string | null {
  return useAtomValue(serverEnvironment.providersValueAtom(environmentId), (providers) => {
    const provider = providers?.find(
      (candidate) => candidate.instanceId === member.providerInstanceId,
    );
    const { modelSlug } = resolveSubagentMetadata({
      model: member.model,
      modelSelection: member.modelSelection,
      provider,
    });
    return formatSubagentEffort({ modelSlug, modelSelection: member.modelSelection, provider });
  });
}

/** @public — the card as drawn, without the timeline's state; Storybook renders it on its own. */
export function ForkSubagentCardView(props: {
  readonly member: ForkSubagentTreeRow;
  /** The reasoning effort it runs at, in the picker's words; null when none is reported. */
  readonly effort?: string | null | undefined;
  readonly titleId?: string | undefined;
  readonly environmentId: EnvironmentId;
  readonly open: boolean;
  readonly onToggle: () => void;
  /** Null when the subagent has no thread to open. */
  readonly openThread: ((intent: SideThreadOpenIntent) => void) | null;
  /** False when the thread can only open in the main view. */
  readonly openInPanel?: boolean | undefined;
}) {
  const { member, titleId, environmentId, open, onToggle, openThread } = props;
  const wellId = useId();
  const trigger = useSideThreadTrigger();
  const remote = member.remote;
  const failed = member.mark === "failed";
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
  const identity = (
    <ForkSubagentIdentity
      member={member}
      effort={props.effort}
      titleId={titleId}
      environmentId={environmentId}
    />
  );
  const elapsed = member.startedAt ? (
    <span className="shrink-0 text-xs font-medium text-foreground tabular-nums">
      <AgentElapsed agent={member} />
    </span>
  ) : null;
  return (
    <div
      data-fork-subagent-card=""
      data-work-entry-id={member.id}
      className="w-full min-w-0 overflow-clip rounded-[12px] border border-border bg-card"
    >
      <div className="flex min-h-14 items-center gap-2 px-3 py-2">
        {details.length === 0 ? (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {identity}
            {elapsed}
          </span>
        ) : (
          // The strip opens and folds the well, ending in the chevron that says so.
          <button
            type="button"
            data-fork-subagent-toggle=""
            aria-expanded={open}
            aria-controls={wellId}
            aria-label={open ? `Hide ${member.title} details` : `Show ${member.title} details`}
            aria-description={
              remote !== undefined
                ? `${member.statusLabel} · on ${remote.label}`
                : member.statusLabel
            }
            onClick={onToggle}
            className="-m-1 flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70"
          >
            {identity}
            {elapsed}
            <span aria-hidden className="flex size-6 shrink-0 items-center justify-center">
              {/* The sidebar shelves' trailing chevron: down while folded, up while open. */}
              <ChevronDownIcon
                className={cn("size-3 transition-transform", open && "rotate-180")}
              />
            </span>
          </button>
        )}
        {openThread === null ? null : (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  data-fork-subagent-open=""
                  aria-label={`Open ${member.title} thread`}
                  {...trigger(openThread, { panel: props.openInPanel ?? true })}
                />
              }
            >
              <ArrowUpRightIcon aria-hidden className="size-3.5 text-foreground" />
            </TooltipTrigger>
            <TooltipPopup side="top">Open thread</TooltipPopup>
          </Tooltip>
        )}
      </div>
      {details.length === 0 ? null : (
        <dl
          id={wellId}
          hidden={!open}
          data-fork-subagent-well=""
          className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-t-[11px] bg-[var(--fork-composer-bg)] px-3 py-2 text-xs leading-[18px] shadow-[inset_0_1px_0_var(--color-border)]"
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

/** A card's header identity: the provider's mark in a tile with the status mark in its corner,
    the title over the model and effort. The composer's background-work list draws it too. */
export function ForkSubagentIdentity(props: {
  readonly member: ForkSubagentTreeRow;
  readonly effort?: string | null | undefined;
  readonly titleId?: string | undefined;
  readonly environmentId: EnvironmentId;
}) {
  const { member, titleId, environmentId } = props;
  const remote = member.remote;
  const failed = member.mark === "failed";
  // The status is the tile's badge; the line under the title says what it runs on.
  const spec = [formatForkSubagentModel(member.model), props.effort].filter(Boolean).join(" · ");
  return (
    <>
      <span
        aria-hidden
        data-fork-task-tile
        className="relative flex size-8 shrink-0 items-center justify-center"
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
      <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
        <span
          id={titleId}
          className="w-full min-w-0 truncate text-sm leading-5 text-foreground"
        >
          {member.title}
        </span>
        <span
          className={cn(
            "w-full min-w-0 truncate text-xs leading-4",
            failed && !spec ? "text-sidebar-v2-status-failed" : "text-muted-foreground",
          )}
        >
          {spec || member.statusLabel}
          {remote !== undefined ? ` · on ${remote.label}` : null}
        </span>
      </span>
    </>
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
