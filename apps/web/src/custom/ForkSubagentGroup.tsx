/**
 * The transcript's subagents as one-line start rows — see
 * `.fork/customizations.yaml#fork-subagent-spawn-card`.
 *
 * Every subagent, alone or in a batch, renders here in place of upstream's
 * lifecycle row and `V2SubagentGroup`. A batch keeps its list-tree lead line
 * ("Kicked off N subagents", the status summary and the batch's elapsed span)
 * above one line per member. A line reads "Started <title> with <model> <effort> · 1m 41s ›",
 * led by the provider's mark with the status mark in its corner, and opens the subagent's thread;
 * its completion notice is the same line, "<title> finished · 1m 41s ›".
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
import type {
  EnvironmentId,
  ModelSelection,
  ScopedThreadRef,
  ServerProvider,
  ThreadId,
} from "@t3tools/contracts";
import { ChevronRightIcon, ListTreeIcon } from "./icons/lucide-hugeicons";
import { type ComponentProps, memo, type ReactNode, use, useId } from "react";

import { AgentElapsed } from "~/components/chat/AgentElapsed";
import type { MessagesTimelineRow } from "~/components/chat/MessagesTimeline.logic";
import { SideThreadsOpenContext, useSideThreadTrigger } from "~/hooks/useSideThreadTrigger";
import { useLinkedThreadOpener } from "~/state/linkedThreadView";
import {
  EnvironmentSubagentAvatar,
  SubagentNotificationLink,
} from "~/components/chat/V2LifecycleRow";
import { subagentResumedSince } from "~/components/chat/V2LifecycleRow.logic";
import { WorkLogBlock } from "~/components/chat/WorkLog";
import { cn } from "~/lib/utils";
import { serverEnvironment } from "~/state/server";
import { useQuietThreadShell } from "~/state/entities";
import { environmentThreadDetails } from "~/state/threads";

import { ForkProviderMarkOr } from "./icons/ModelPickerProviderGlyph";
import {
  forkSubagentMembers,
  forkSubagentRowFromAgent,
  formatForkSubagentModel,
  resolveForkSubagentRow,
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

/** Every subagent of the row renders as a line in one keyed list, so a lone line that gains a
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
        className="flex w-full min-w-0 flex-col items-start gap-1 py-0.5 text-sm leading-5"
      >
        {batch ? (
          <SubagentBatchLead id={leadId} members={members} environmentId={environmentId} />
        ) : null}
        {members.map((item) => (
          <LiveSubagentLine
            key={item.id}
            item={item}
            titleId={batch ? undefined : leadId}
            environmentId={environmentId}
            onOpenThread={onOpenThread}
          />
        ))}
      </div>
    </WorkLogBlock>
  );
});

/** One line. It selects only its own agent, so another subagent's progress does not re-render it. */
const LiveSubagentLine = memo(function LiveSubagentLine(props: {
  readonly item: ForkSubagentItem;
  /** A lone line's visible title names its group. */
  readonly titleId?: string | undefined;
  readonly environmentId: EnvironmentId;
  readonly onOpenThread: OpenThread;
}) {
  const { item, titleId, environmentId, onOpenThread } = props;
  const parentRef = scopeThreadRef(environmentId, item.threadId);
  const live = useAtomValue(
    environmentThreadDetails.threadAtom(parentRef),
    (thread) => thread?.projection.subagents.find((agent) => agent.id === item.subagentId) ?? null,
  );
  const member = resolveForkSubagentRow(item, live);
  const opener = useOpenSubagentThread(member, parentRef, onOpenThread);
  const title = useForkSubagentTitle(member, environmentId);
  const effort = useForkSubagentEffort(member, environmentId);
  return (
    <ForkSubagentStartLineView
      member={title === member.title ? member : { ...member, title }}
      effort={effort}
      titleId={titleId}
      environmentId={environmentId}
      openThread={opener.open}
      openInPanel={opener.panel}
    />
  );
});

/** @public — the start line as drawn, without the timeline's state; Storybook renders it on its own. */
export function ForkSubagentStartLineView(props: {
  readonly member: ForkSubagentTreeRow;
  /** The reasoning effort it runs at, in the picker's words; null when none is reported. */
  readonly effort?: string | null | undefined;
  readonly titleId?: string | undefined;
  readonly environmentId: EnvironmentId;
  /** Null when the subagent has no thread to open. */
  readonly openThread: ((intent: SideThreadOpenIntent) => void) | null;
  /** False when the thread can only open in the main view. */
  readonly openInPanel?: boolean | undefined;
}) {
  const { member } = props;
  const remote = member.remote;
  const spec = [formatForkSubagentModel(member.model), props.effort].filter(Boolean).join(" ");
  const runsOn = [spec ? `with ${spec}` : null, remote ? `on ${remote.label}` : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <ForkSubagentLine
      root={{ "data-fork-subagent-start": member.id }}
      member={member}
      environmentId={props.environmentId}
      withStatus
      description={
        remote === undefined ? member.statusLabel : `${member.statusLabel} · on ${remote.label}`
      }
      open={props.openThread}
      panel={props.openInPanel ?? true}
    >
      <span className="shrink-0">{"Started"}</span>
      {/* A long title gives way before the model and effort do. */}
      <span id={props.titleId} className="min-w-0 truncate text-foreground">
        {member.title}
      </span>
      {runsOn ? <span className="shrink-0">{runsOn}</span> : null}
    </ForkSubagentLine>
  );
}

/** A subagent's completion notice as one line, "<title> finished · 1m 41s ›", that opens its
    thread; the start line stays in the turn that launched it. A question or progress notice, or one
    whose agent has resumed since, keeps upstream's row. */
export function ForkSubagentNotice(notice: ComponentProps<typeof SubagentNotificationLink>) {
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
  if (agent === null) return notice.fallback;
  const settled = outcome === "completed" || outcome === "failed" || outcome === "cancelled";
  if (!settled || subagentResumedSince(agent, notice.createdAt)) {
    return <SubagentNotificationLink {...notice} />;
  }
  return (
    <ForkSubagentNoticeLine
      member={forkSubagentRowFromAgent(agent)}
      outcome={outcome}
      parentRef={parentRef}
      onOpenThread={notice.onOpenThread}
    />
  );
}

function ForkSubagentNoticeLine(props: {
  readonly member: ForkSubagentTreeRow;
  readonly outcome: "completed" | "failed" | "cancelled";
  readonly parentRef: ScopedThreadRef;
  readonly onOpenThread: OpenThread;
}) {
  const { member, outcome, parentRef, onOpenThread } = props;
  const opener = useOpenSubagentThread(member, parentRef, onOpenThread);
  const title = useForkSubagentTitle(member, parentRef.environmentId);
  const verb = outcome === "completed" ? "finished" : outcome === "failed" ? "failed" : "stopped";
  return (
    <ForkSubagentLine
      root={{ "data-fork-subagent-notice": member.id }}
      member={{ ...member, title }}
      environmentId={parentRef.environmentId}
      description={verb}
      open={opener.open}
      panel={opener.panel}
    >
      <span className="min-w-0 truncate">{title}</span>
      <span className="shrink-0">{verb}</span>
    </ForkSubagentLine>
  );
}

/** A subagent as one muted line, led by its provider's mark and ending in its elapsed time; it
    opens the subagent's thread when there is one. The start line and the completion notice both. */
function ForkSubagentLine(props: {
  readonly root: Readonly<Record<`data-${string}`, string>>;
  readonly member: ForkSubagentTreeRow;
  readonly environmentId: EnvironmentId;
  /** Draws the status mark in the provider mark's corner. */
  readonly withStatus?: boolean | undefined;
  readonly description?: string | undefined;
  readonly open: ((intent: SideThreadOpenIntent) => void) | null;
  readonly panel: boolean;
  readonly children: ReactNode;
}) {
  const { member, open } = props;
  const trigger = useSideThreadTrigger();
  const content = (
    <>
      <ForkSubagentLineMark
        member={member}
        environmentId={props.environmentId}
        withStatus={props.withStatus === true}
      />
      {props.children}
      {member.startedAt ? (
        <span className="shrink-0 tabular-nums">
          {"· "}
          <AgentElapsed agent={member} />
        </span>
      ) : null}
    </>
  );
  const line = "flex min-w-0 items-center gap-1 rounded-md px-1 text-sm leading-relaxed";
  return (
    <div {...props.root} className="flex min-w-0 max-w-full text-muted-foreground">
      {open === null ? (
        <span className={line}>
          {content}
          {/* The marks are hidden, so the status reaches screen readers here. */}
          {props.description ? <span className="sr-only">{`, ${props.description}`}</span> : null}
        </span>
      ) : (
        <button
          type="button"
          // oxlint-disable-next-line t3code/no-untranslated-copy -- fork copy stays English (fork-i18n-catalog)
          aria-label={`Open ${member.title} thread`}
          aria-description={props.description}
          {...trigger(open, { panel: props.panel })}
          className={cn(
            line,
            "cursor-pointer transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70",
          )}
        >
          {content}
          <ChevronRightIcon aria-hidden className="size-3.5 shrink-0" />
        </button>
      )}
    </div>
  );
}

/** The line's provider logo: the fork's own mark where it draws one (Claude's mascot, Codex's
    cloud), else the avatar; a start line badges it with the status mark. */
function ForkSubagentLineMark(props: {
  readonly member: ForkSubagentTreeRow;
  readonly environmentId: EnvironmentId;
  readonly withStatus: boolean;
}) {
  const { member } = props;
  return (
    <span aria-hidden className="relative me-0.5 flex size-4 shrink-0 items-center justify-center">
      <ForkProviderMarkOr
        driver={forkSubagentMarkDriver(member)}
        size="1rem"
        fallback={
          <EnvironmentSubagentAvatar
            environmentId={props.environmentId}
            providerInstanceId={member.providerInstanceId}
            driver={member.driver}
            remote={member.remote}
            className="size-4 rounded-none border-0 bg-transparent ring-0"
            iconClassName="size-4"
          />
        }
      />
      {props.withStatus ? (
        <span className="absolute -right-1 -bottom-1 flex size-3 items-center justify-center rounded-full bg-background">
          <span className="flex scale-75 items-center justify-center">
            <SidebarV2StatusMark
              status={forkSubagentStatusMark(member.mark)}
              seed={member.id}
              idle="dot"
            />
          </span>
        </span>
      ) : null}
    </span>
  );
}

/** An untitled subagent (a completion notice's record often is) takes its child thread's title,
    which is generated from the ask; the model falls back to the ask itself. */
function useForkSubagentTitle(member: ForkSubagentTreeRow, environmentId: EnvironmentId): string {
  const childTitle = useQuietThreadShell(
    !member.titled && member.childThreadId !== null
      ? scopeThreadRef(environmentId, member.childThreadId)
      : null,
  )?.source.title;
  return childTitle ? formatSubagentDisplayTitle(childTitle) : member.title;
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
    SubagentLifecycleRow (V2LifecycleRow.tsx), which the line replaces. */
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

/** The reasoning effort a subagent runs at, in the picker's words; null when none is reported.
    Selected down to the label, so a provider update re-renders only the rows whose effort changed. */
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

/** The model a thread runs and its effort, in the subagent line's words, for a bot panel's row.
    Each value is selected on its own, so a providers update re-renders only the rows whose words
    changed. Before providers load the label is the slug's, and there is no effort or driver. */
export function useForkThreadModel(thread: {
  readonly environmentId: EnvironmentId;
  readonly modelSelection: ModelSelection;
  readonly runtime: { readonly providerInstanceId?: string | null | undefined } | null;
}) {
  const { environmentId, modelSelection } = thread;
  const instanceId = thread.runtime?.providerInstanceId ?? modelSelection.instanceId;
  const providers = serverEnvironment.providersValueAtom(environmentId);
  const read = (all: ReadonlyArray<ServerProvider> | null | undefined) => {
    const provider = all?.find((candidate) => candidate.instanceId === instanceId);
    return { provider, ...resolveSubagentMetadata({ model: null, modelSelection, provider }) };
  };
  const label = useAtomValue(providers, (all) => read(all).modelLabel);
  const effort = useAtomValue(providers, (all) => {
    const { provider, modelSlug } = read(all);
    return formatSubagentEffort({ modelSlug, modelSelection, provider });
  });
  const driver = useAtomValue(providers, (all) => read(all).provider?.driver ?? null);
  return { environmentId, instanceId, driver, label, effort };
}

export type ForkThreadModel = ReturnType<typeof useForkThreadModel>;

/** The driver whose fork mark a subagent shows: none for a linked environment's task, which names
    its driver only as a label, so the avatar resolves the provider that really runs it there. */
export function forkSubagentMarkDriver(
  member: Pick<ForkSubagentTreeRow, "driver" | "remote">,
): ForkSubagentTreeRow["driver"] | null {
  return member.remote === undefined ? member.driver : null;
}

/** The sidebar's mark set by a subagent's status. Idle and stopped both
    settle on the hollow idle circle: nothing pending, nothing to report. */
export function forkSubagentStatusMark(mark: ForkSubagentMark): SidebarV2TopStatusMark | null {
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
