import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { ArrowUpRightIcon } from "./icons/lucide-hugeicons";

import { ComputerActivityIcon, ComputerTerminalIcon } from "./icons/lucide-hugeicons";

import { AgentElapsed } from "~/components/chat/AgentElapsed";
import { ComposerControl } from "~/components/chat/ComposerControl";
import { Popover, PopoverClose, PopoverPopup, PopoverTrigger } from "~/components/ui/popover";

import {
  composerBackgroundWorkLabel,
  glanceCommandLabel,
  type ComposerBackgroundWorkItem,
} from "./composerBackgroundWork.logic";
import { BackgroundWorkLayersMark } from "./BackgroundWorkLayersMark";
import { EnvironmentSubagentAvatar } from "~/components/chat/V2LifecycleRow";
import { cn } from "~/lib/utils";
import {
  forkSubagentMarkDriver,
  forkSubagentStatusMark,
  useForkSubagentEffort,
} from "./ForkSubagentGroup";
import { formatForkSubagentModel, type ForkSubagentTreeRow } from "./forkSubagentTree";
import { ForkProviderMarkOr, hasForkProviderMark } from "./icons/ModelPickerProviderGlyph";
import { SidebarV2StatusMark } from "./SidebarV2StatusIndicator";
import { StopSquareIcon } from "./StopSquareIcon";

export interface ComposerBackgroundWorkViewProps {
  /** A subagent's task row draws its identity: mark, status, title, model (composerBackgroundWorkItems). */
  readonly items: ReadonlyArray<ComposerBackgroundWorkItem>;
  readonly stopping: boolean;
  /** False when Stop has nothing to act on (mid-turn, or no operate scope): the square is not drawn. */
  readonly canStop: boolean;
  readonly onStop: () => void;
  readonly onOpenThread: (threadId: ThreadId) => void;
  readonly environmentId: EnvironmentId;
}

/** Background work as a chip above the composer (fork-composer-shell): the label opens the task
 * list, a subagent's row opens its thread, and the square stops it all. @public — Storybook draws it. */
export function ComposerBackgroundWorkChip(props: ComposerBackgroundWorkViewProps) {
  const label = props.stopping ? "Stopping..." : composerBackgroundWorkLabel(props.items);
  return (
    <span data-fork-composer-status-chip="background-work">
      {/* A button's children are presentational, so "Stopping..." is announced from here. */}
      <span role="status" className="sr-only">
        {label}
      </span>
      <Popover>
        <PopoverTrigger
          openOnHover
          render={
            <ComposerControl
              size="xs"
              data-fork-status-chip-main
              data-fork-status-chip-solo={props.canStop ? undefined : ""}
              aria-label={`${label}: show background work`}
            />
          }
        >
          <span
            data-fork-liveness-mark
            aria-hidden
            className="flex size-3.5 shrink-0 items-center justify-center"
          >
            <BackgroundWorkLayersMark />
          </span>
          <span aria-hidden className="min-w-0 truncate">
            {label}
          </span>
        </PopoverTrigger>
        <PopoverPopup
          side="top"
          align="start"
          sideOffset={6}
          width={props.items.some((item) => item.kind === "subagent") ? "md" : "sm"}
          padding="compact"
          data-fork-glass-rim
          data-fork-background-work-popup
        >
          <ul data-fork-monitoring-tasks className="flex max-h-60 flex-col overflow-y-auto">
            {props.items.map((task) => (
              <BackgroundWorkTaskRow
                key={task.taskId}
                task={task}
                environmentId={props.environmentId}
                onOpenThread={props.onOpenThread}
              />
            ))}
          </ul>
        </PopoverPopup>
      </Popover>
      {props.canStop ? (
        <ComposerControl
          size="xs"
          data-fork-status-chip-stop
          aria-label={props.stopping ? "Stopping background work" : "Stop background work"}
          disabled={props.stopping}
          onClick={props.onStop}
        >
          <StopSquareIcon size={10} />
        </ComposerControl>
      ) : null}
    </span>
  );
}

function BackgroundWorkTaskRow(props: {
  readonly task: ComposerBackgroundWorkItem;
  readonly environmentId: EnvironmentId;
  readonly onOpenThread: (threadId: ThreadId) => void;
}) {
  const { task } = props;
  const childThreadId = task.childThreadId;
  if (childThreadId === undefined && task.subagent !== undefined) {
    // A subagent without a local child thread (a linked environment's) has nothing to open.
    return (
      <li className="flex">
        <span data-fork-monitoring-task>
          <SubagentTaskIdentity member={task.subagent} environmentId={props.environmentId} />
        </span>
      </li>
    );
  }
  if (childThreadId === undefined) {
    const label = task.kind === "command" ? glanceCommandLabel(task.label) : task.label;
    return (
      <li className="flex">
        <span data-fork-monitoring-task aria-description={task.kind}>
          <span
            aria-hidden
            data-fork-task-tile
            className="flex size-8 shrink-0 items-center justify-center"
          >
            {task.kind === "command" ? (
              <ComputerTerminalIcon className="size-4" />
            ) : (
              <ComputerActivityIcon className="size-4" />
            )}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm leading-5">{label}</span>
        </span>
      </li>
    );
  }
  return (
    <li className="flex">
      {/* Closes the list: the thread may open beside this composer, which stays mounted. */}
      <PopoverClose
        render={<button type="button" />}
        data-fork-monitoring-task
        aria-label={`Open ${task.label}`}
        onClick={() => props.onOpenThread(childThreadId)}
      >
        {task.subagent === undefined ? (
          <span className="min-w-0 flex-1 truncate">{task.label}</span>
        ) : (
          <SubagentTaskIdentity member={task.subagent} environmentId={props.environmentId} />
        )}
        <ArrowUpRightIcon aria-hidden className="size-3.5 shrink-0 text-foreground" />
      </PopoverClose>
    </li>
  );
}

/** A subagent's row wears its transcript card's header: tile, title over model, elapsed. */
function SubagentTaskIdentity(props: {
  readonly member: ForkSubagentTreeRow;
  readonly environmentId: EnvironmentId;
}) {
  const { member } = props;
  const effort = useForkSubagentEffort(member, props.environmentId);
  return (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <ForkSubagentIdentity member={member} effort={effort} environmentId={props.environmentId} />
      </span>
      {member.startedAt ? (
        <span className="shrink-0 text-xs font-medium text-foreground tabular-nums">
          <AgentElapsed agent={member} />
        </span>
      ) : null}
    </>
  );
}

/** A subagent task row's identity: the provider's mark in a tile with the status mark in its
    corner, the title over the model and effort. @public — Storybook draws it. */
export function ForkSubagentIdentity(props: {
  readonly member: ForkSubagentTreeRow;
  readonly effort?: string | null | undefined;
  readonly titleId?: string | undefined;
  readonly environmentId: EnvironmentId;
}) {
  const { member, titleId, environmentId } = props;
  const remote = member.remote;
  const failed = member.mark === "failed";
  const markDriver = forkSubagentMarkDriver(member);
  // The status is the tile's badge; the line under the title says what it runs on.
  const spec = [formatForkSubagentModel(member.model), props.effort].filter(Boolean).join(" · ");
  return (
    <>
      <span
        aria-hidden
        data-fork-task-tile
        className="relative flex size-8 shrink-0 items-center justify-center"
      >
        <ForkProviderMarkOr
          driver={markDriver}
          size="1.25rem"
          fallback={
            <EnvironmentSubagentAvatar
              environmentId={environmentId}
              providerInstanceId={member.providerInstanceId}
              driver={member.driver}
              remote={remote}
              className="size-5 rounded-none border-0 bg-transparent ring-0"
              iconClassName="size-5"
            />
          }
        />
        {markDriver !== null && hasForkProviderMark(markDriver) ? (
          // As the model picker does: the resolved avatar over the mark, glyph hidden, draws the
          // instance badge alone when shouldShowInstanceBadge asks for one, in the corner the
          // status mark leaves free.
          <EnvironmentSubagentAvatar
            environmentId={environmentId}
            providerInstanceId={member.providerInstanceId}
            driver={member.driver}
            className="absolute inset-0 size-auto rounded-none border-0 bg-transparent ring-0"
            providerIconClassName="absolute inset-0"
            iconClassName="hidden"
            badgeClassName="-top-1.25 -right-1.25 bottom-auto h-3 min-w-3 px-0.5 text-5xs"
          />
        ) : null}
        <span className="absolute -right-0.5 -bottom-0.5 flex size-3.5 items-center justify-center rounded-full bg-card">
          <span className="flex scale-75 items-center justify-center">
            <SidebarV2StatusMark
              status={forkSubagentStatusMark(member.mark)}
              seed={member.id}
              idle="dot"
            />
          </span>
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
        <span id={titleId} className="w-full min-w-0 truncate text-sm leading-5 text-foreground">
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
