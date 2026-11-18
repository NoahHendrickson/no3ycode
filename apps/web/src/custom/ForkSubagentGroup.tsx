/**
 * The transcript's subagents as cards (Basic UI kit, Figma 89:704) — see
 * `.fork/customizations.yaml#fork-subagent-spawn-card`.
 *
 * Every subagent, alone or in a batch, renders here in place of upstream's
 * lifecycle row and `V2SubagentGroup`. A batch keeps its list-tree lead line
 * ("Kicked off N subagents", the status summary and the batch's elapsed span)
 * above one card per member. A card is a header (the provider's mark in a tile
 * with the status mark in its corner, the title over the status word, the
 * elapsed time, a chevron) and a well underneath: the task it was given, what
 * it is doing now or what it found, and the model. The well starts open while
 * the subagent works and folds once it settles, unless the chevron was used.
 * The header opens the subagent's thread when it has one.
 *
 * Status comes from the thread's live subagent roster where the projection
 * keeps it current, falling back to the item's own fields for settled
 * history. Elapsed timers self-tick through `AgentElapsed`'s DOM writes.
 */
import { useAtomValue } from "@effect/atom-react";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { ChevronRightIcon, ListTreeIcon } from "lucide-react";
import { type CSSProperties, memo, use, useId, useState } from "react";

import { AgentElapsed } from "~/components/chat/AgentElapsed";
import type { MessagesTimelineRow } from "~/components/chat/MessagesTimeline.logic";
import { TimelineRowCtx } from "~/components/chat/timelineRowContext";
import { EnvironmentSubagentAvatar } from "~/components/chat/V2LifecycleRow";
import { WorkLogBlock } from "~/components/chat/WorkLog";
import { MiddleTruncate } from "~/components/ui/middle-truncate";
import { cn } from "~/lib/utils";
import { useEnvironment } from "~/state/environments";
import { environmentThreadDetails } from "~/state/threads";
import { buildThreadRouteParams } from "~/threadRoutes";

import { ForkProviderMark, hasForkProviderMark } from "./icons/ModelPickerProviderGlyph";
import {
  formatForkSubagentModel,
  resolveForkSubagentTree,
  type ForkSubagentItem,
  type ForkSubagentMark,
  type ForkSubagentTreeRow,
} from "./forkSubagentTree";
import { SidebarV2StatusMark, type SidebarV2TopStatusMark } from "./SidebarV2StatusIndicator";

export const ForkSubagentGroup = memo(function ForkSubagentGroup(props: {
  readonly row: Extract<MessagesTimelineRow, { readonly kind: "event" }>;
  readonly environmentId: EnvironmentId;
  readonly onOpenThread: (threadId: ThreadId) => void;
}) {
  const { row, environmentId, onOpenThread } = props;
  const members = (row.subagents ?? [row.projectedItem]).flatMap(({ item }) =>
    item.type === "subagent" ? [item as ForkSubagentItem] : [],
  );
  // A lone card selects its own agent, so another subagent's progress does not re-render it.
  const lone = members.length === 1 ? members[0]!.subagentId : null;
  const selected = useAtomValue(
    environmentThreadDetails.threadAtom(
      scopeThreadRef(environmentId, row.projectedItem.item.threadId),
    ),
    (thread) =>
      lone === null
        ? thread?.projection.subagents
        : (thread?.projection.subagents.find((agent) => agent.id === lone) ?? null),
  );
  const liveAgents = Array.isArray(selected) ? selected : selected ? [selected] : undefined;
  const tree = resolveForkSubagentTree(members, liveAgents);

  return (
    <WorkLogBlock continues={row.continuesWorkLog}>
      <div
        data-fork-subagent-tree=""
        data-subagent-group
        role="group"
        aria-label={tree.rows.length > 1 ? tree.lead : tree.rows[0]?.title}
        className="flex w-full min-w-0 flex-col items-start gap-2 py-1 text-sm leading-5"
      >
        {tree.rows.length > 1 ? (
          <span className="flex w-full min-w-0 items-start gap-2 pb-1">
            <span aria-hidden className="flex size-4 shrink-0 items-center py-px">
              <ListTreeIcon weight="stroke" className="size-4 text-foreground" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col items-start">
              <span className="w-full min-w-0 truncate text-foreground">{tree.lead}</span>
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
        ) : null}
        {tree.rows.map((member) => (
          <ForkSubagentCard
            key={member.id}
            member={member}
            anchorKey={row.id}
            environmentId={environmentId}
            onOpenThread={onOpenThread}
          />
        ))}
      </div>
    </WorkLogBlock>
  );
});

function ForkSubagentCard(props: {
  readonly member: ForkSubagentTreeRow;
  /** The timeline row, which keeps its scroll position while a card opens or folds. */
  readonly anchorKey: string;
  readonly environmentId: EnvironmentId;
  readonly onOpenThread: (threadId: ThreadId) => void;
}) {
  const { member, anchorKey, environmentId, onOpenThread } = props;
  // The chevron's choice lives in the thread's timeline view state, so it survives the row
  // scrolling out of the virtualised list or its turn folding.
  const ctx = use(TimelineRowCtx);
  const chosen = ctx.workGroupViewState.expandedEntries;
  const openKey = `subagent-card:open:${member.id}`;
  const closedKey = `subagent-card:closed:${member.id}`;
  const [chosenOpen, setChosenOpen] = useState<boolean | null>(() =>
    chosen.has(openKey) ? true : chosen.has(closedKey) ? false : null,
  );
  const open = chosenOpen ?? member.active;
  const toggle = () => {
    ctx.onToggleWorkEntry(anchorKey, open);
    chosen.delete(open ? openKey : closedKey);
    chosen.add(open ? closedKey : openKey);
    setChosenOpen(!open);
  };
  const wellId = useId();
  const remoteEnvironment = useEnvironment(member.remote?.environmentId ?? null);
  const navigate = useNavigate();
  const childThreadId = member.childThreadId;
  const remote = member.remote;
  // A task in a linked environment opens there, if this client is connected to it.
  const openThread =
    childThreadId !== null
      ? () => onOpenThread(childThreadId)
      : remote !== undefined && remoteEnvironment !== null
        ? () =>
            void navigate({
              to: "/$environmentId/$threadId",
              params: buildThreadRouteParams(scopeThreadRef(remote.environmentId, remote.threadId)),
            })
        : null;
  const model = formatForkSubagentModel(member.model);
  const identity = (
    <>
      <span
        aria-hidden
        className="relative flex size-8 shrink-0 items-center justify-center rounded-[4px] border border-border bg-accent"
      >
        {hasForkProviderMark(member.driver) ? (
          <span className="flex" style={MARK_SIZE}>
            <ForkProviderMark driver={member.driver} />
          </span>
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
        <span className="w-full min-w-0 truncate text-sm leading-4 font-medium text-foreground">
          {member.title}
        </span>
        <span
          className={cn(
            "w-full min-w-0 truncate text-sm leading-4",
            member.failed ? "text-destructive" : "text-muted-foreground",
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
        <button
          type="button"
          data-fork-subagent-toggle=""
          aria-expanded={open}
          aria-controls={wellId}
          aria-label={open ? `Hide ${member.title} details` : `Show ${member.title} details`}
          onClick={toggle}
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[8px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70"
        >
          <ChevronRightIcon className={cn("size-3", open && "rotate-90")} />
        </button>
      </div>
      <dl
        id={wellId}
        hidden={!open}
        data-fork-subagent-well=""
        className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-t-[7px] bg-[var(--fork-composer-bg)] px-3 py-2 text-xs leading-[18px] shadow-[inset_0_1px_0_var(--color-border)]"
      >
        {member.prompt ? (
          <>
            <dt className="text-muted-foreground">Task</dt>
            <dd className="line-clamp-2 text-foreground">{member.prompt}</dd>
          </>
        ) : null}
        {member.activity ? (
          <>
            <dt className="text-muted-foreground">{member.activity.label}</dt>
            <dd className={cn("min-w-0", member.failed ? "text-destructive" : "text-foreground")}>
              {/* A bare path keeps its filename when it is too long for the line. */}
              {member.activity.text.includes("/") && !member.activity.text.includes(" ") ? (
                <MiddleTruncate value={member.activity.text} showTitle={false} className="flex" />
              ) : (
                <span className="line-clamp-3">{member.activity.text}</span>
              )}
            </dd>
          </>
        ) : null}
        {model ? (
          <>
            <dt className="text-muted-foreground">Model</dt>
            <dd className="truncate text-foreground">{model}</dd>
          </>
        ) : null}
      </dl>
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
