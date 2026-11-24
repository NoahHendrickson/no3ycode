import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { ArrowUpRightIcon } from "lucide-react";

import {
  ComputerActivityIcon,
  ComputerTerminalIcon,
  ElectricityStackIcon,
} from "./icons/lucide-hugeicons";

import { AgentElapsed } from "~/components/chat/AgentElapsed";
import { ComposerControl } from "~/components/chat/ComposerControl";
import { Popover, PopoverClose, PopoverPopup, PopoverTrigger } from "~/components/ui/popover";

import {
  glanceCommandLabel,
  type ComposerBackgroundWorkItem,
} from "./composerBackgroundWork.logic";
import { ForkSubagentIdentity, useForkSubagentEffort } from "./ForkSubagentGroup";
import type { ForkSubagentTreeRow } from "./forkSubagentTree";
import { StopSquareIcon } from "./StopSquareIcon";

export interface ComposerBackgroundWorkViewProps {
  /** A subagent's task row draws its transcript card's header (composerBackgroundWorkItems). */
  readonly items: ReadonlyArray<ComposerBackgroundWorkItem>;
  readonly stopping: boolean;
  /** False when Stop has nothing to act on (mid-turn, or no operate scope): the square is not drawn. */
  readonly canStop: boolean;
  readonly onStop: () => void;
  readonly onOpenThread: (threadId: ThreadId) => void;
  readonly environmentId: EnvironmentId;
}

/** One label for any mix of work: subagents, commands, monitors and PR watches alike. */
function resolveBackgroundWorkLabel(props: ComposerBackgroundWorkViewProps): string {
  if (props.stopping) return "Stopping...";
  return props.items.length === 1 ? "Background task" : "Background tasks";
}

/** Background work as a chip above the composer (fork-composer-shell): the label opens the task
 * list, a subagent's row opens its thread, and the square stops it all. @public — Storybook draws it. */
export function ComposerBackgroundWorkChip(props: ComposerBackgroundWorkViewProps) {
  const label = resolveBackgroundWorkLabel(props);
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
            className="flex size-[14px] shrink-0 items-center justify-center"
          >
            <ElectricityStackIcon />
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
