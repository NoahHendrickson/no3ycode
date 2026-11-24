import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { ArrowUpRightIcon } from "lucide-react";
import { Fragment } from "react";

import { ComputerActivityIcon, ComputerTerminalIcon } from "./icons/lucide-hugeicons";

import { AgentElapsed } from "~/components/chat/AgentElapsed";
import { ComposerControl } from "~/components/chat/ComposerControl";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "~/components/ui/menu";

import {
  glanceCommandLabel,
  type ComposerBackgroundWorkItem,
  type ComposerBackgroundWorkPresentation,
} from "./composerBackgroundWork.logic";
import { ForkSubagentIdentity, useForkSubagentEffort } from "./ForkSubagentGroup";
import type { ForkSubagentTreeRow } from "./forkSubagentTree";
import { SidebarV2MonitoringMark, SidebarV2WorkingMark } from "./SidebarV2StatusIndicator";
import { StopSquareIcon } from "./StopSquareIcon";

export interface ComposerBackgroundWorkViewProps {
  /** A subagent's task row draws its transcript card's header (resolveComposerBackgroundWork). */
  readonly presentation: ComposerBackgroundWorkPresentation;
  /** Stable seed for the working mark so remounts keep the same phase. */
  readonly seed: string;
  readonly stopping: boolean;
  /** False when the client lacks the operate scope: Stop stays visible but inert. */
  readonly canStop: boolean;
  readonly onStop: () => void;
  readonly onOpenThread: (threadId: ThreadId) => void;
  readonly environmentId: EnvironmentId;
}

/** `waiting` is upstream's "this work will wake the agent" (subagents, monitors); a dev server
 * that merely outlives the turn is monitoring-only, so it does not rain. */
function resolveBackgroundWorkLabel(props: ComposerBackgroundWorkViewProps): string {
  if (props.stopping) return "Stopping...";
  if (!props.presentation.waiting) return "Monitoring";
  const liveCount = props.presentation.items.filter((item) => item.kind === "subagent").length;
  if (liveCount > 0) return `${liveCount} ${liveCount === 1 ? "agent" : "agents"}`;
  return "Working";
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
      <Menu>
        <MenuTrigger
          openOnHover
          render={
            <ComposerControl
              size="xs"
              data-fork-status-chip-main
              aria-label={`${label}: show background work`}
            />
          }
        >
          <span
            data-fork-liveness-mark
            aria-hidden
            className="flex size-3.5 shrink-0 items-center justify-center"
          >
            {props.presentation.waiting ? (
              <SidebarV2WorkingMark seed={props.seed} />
            ) : (
              <SidebarV2MonitoringMark />
            )}
          </span>
          <span aria-hidden className="min-w-0 truncate">
            {label}
          </span>
        </MenuTrigger>
        <MenuPopup
          side="top"
          align="start"
          sideOffset={6}
          className={
            props.presentation.items.some((item) => item.kind === "subagent") ? "w-80" : "w-64"
          }
          data-fork-glass-rim
          data-fork-background-work-popup
        >
          {props.presentation.items.map((task, index) => (
            <Fragment key={task.taskId}>
              {index > 0 ? <MenuSeparator className="-mx-1" /> : null}
              <BackgroundWorkTaskRow
                task={task}
                environmentId={props.environmentId}
                onOpenThread={props.onOpenThread}
              />
            </Fragment>
          ))}
        </MenuPopup>
      </Menu>
      <ComposerControl
        size="xs"
        data-fork-status-chip-stop
        aria-label={props.stopping ? "Stopping background work" : "Stop background work"}
        disabled={props.stopping || !props.canStop}
        onClick={props.onStop}
      >
        <StopSquareIcon size={10} />
      </ComposerControl>
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
  if (childThreadId === undefined) {
    const label = task.kind === "command" ? glanceCommandLabel(task.label) : task.label;
    return (
      <div
        data-fork-monitoring-task
        aria-description={task.kind}
        className="flex min-h-8 items-center gap-2 px-2 py-1 text-sm sm:min-h-7"
      >
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
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </div>
    );
  }
  return (
    // Choosing it closes the menu: the thread may open beside this composer, which stays mounted.
    <MenuItem
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
    </MenuItem>
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
