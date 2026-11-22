import type {
  PendingBackgroundWorkItem,
  PendingBackgroundWorkPresentation,
} from "@t3tools/client-runtime/state/thread-execution";
import type { ThreadId } from "@t3tools/contracts";
import { type ReactNode, type RefObject, useRef, useState } from "react";

import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";

import { hasUnseenApproval, resolveCollapsedTaskIds } from "./composerBackgroundWork.logic";
import { ChevronDownIcon, ChevronRightIcon } from "./icons/lucide-hugeicons";
import { SidebarV2MonitoringMark, SidebarV2WorkingMark } from "./SidebarV2StatusIndicator";
import { StopSquareIcon } from "./StopSquareIcon";

/** The work section ChatComposer stacks into its top drawer, above the usage tray. */
export interface ComposerBackgroundWorkVessel {
  readonly open: boolean;
  readonly content: ReactNode;
  readonly onCollapse: () => void;
}

export interface ComposerBackgroundWorkViewProps {
  readonly presentation: PendingBackgroundWorkPresentation;
  /** Stable seed for the working mark so remounts keep the same phase. */
  readonly seed: string;
  readonly stopping: boolean;
  /** False when the client lacks the operate scope: Stop stays visible but inert. */
  readonly canStop: boolean;
  readonly onStop: () => void;
  readonly onOpenThread: (threadId: ThreadId) => void;
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

function BackgroundWorkMark(props: Pick<ComposerBackgroundWorkViewProps, "presentation" | "seed">) {
  return (
    <span data-fork-liveness-mark className="flex size-[14px] shrink-0 items-center justify-center">
      {props.presentation.waiting ? (
        <SidebarV2WorkingMark seed={props.seed} />
      ) : (
        <SidebarV2MonitoringMark />
      )}
    </span>
  );
}

/** Background work as a context-row toggle and a top-drawer section (fork-composer-shell). It opens
 * whenever an unseen task starts; a collapse holds until one does. Each subagent approval arriving
 * above the composer, which the drawer would cover, collapses it once; the toggle still reopens it. */
export function useComposerBackgroundWork(
  view: ComposerBackgroundWorkViewProps | null,
  approvalIds: ReadonlySet<string>,
) {
  // The tasks on screen when the drawer was collapsed.
  const [collapsedTaskIds, setCollapsedTaskIds] = useState<ReadonlySet<string> | null>(null);
  const [seenApprovalIds, setSeenApprovalIds] = useState<ReadonlySet<string>>(() => new Set());
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const tasks = view?.presentation.items ?? [];
  let heldTaskIds = resolveCollapsedTaskIds(tasks, collapsedTaskIds);
  const approvalArrived = hasUnseenApproval(approvalIds, seenApprovalIds);
  if (approvalArrived || approvalIds.size !== seenApprovalIds.size) {
    setSeenApprovalIds(approvalIds);
    if (approvalArrived) heldTaskIds = new Set(tasks.map((task) => task.taskId));
  }
  if (heldTaskIds !== collapsedTaskIds) setCollapsedTaskIds(heldTaskIds);
  if (view === null) return { toggle: null, vessel: null };

  const open = heldTaskIds === null;
  const collapse = () => {
    setCollapsedTaskIds(new Set(tasks.map((task) => task.taskId)));
    toggleRef.current?.focus();
  };

  return {
    toggle: (
      <ComposerBackgroundWorkToggle
        {...view}
        triggerRef={toggleRef}
        open={open}
        onToggle={() => (open ? collapse() : setCollapsedTaskIds(null))}
      />
    ),
    vessel: {
      open,
      onCollapse: collapse,
      content: <ComposerBackgroundWorkSection {...view} onCollapse={collapse} />,
    } satisfies ComposerBackgroundWorkVessel,
  };
}

/** @public — the context-row icon, from plain props; Storybook draws it. */
export function ComposerBackgroundWorkToggle({
  triggerRef,
  open,
  onToggle,
  ...view
}: ComposerBackgroundWorkViewProps & {
  readonly triggerRef?: RefObject<HTMLButtonElement | null>;
  readonly open: boolean;
  readonly onToggle: () => void;
}) {
  const label = resolveBackgroundWorkLabel(view);
  return (
    <>
      {/* A button's children are presentational, so "Stopping..." is announced from here. */}
      <span role="status" className="sr-only">
        {label}
      </span>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              ref={triggerRef}
              type="button"
              data-fork-background-work-toggle
              aria-expanded={open}
              data-pressed={open ? "" : undefined}
              aria-label={`${label}: ${open ? "hide" : "show"} background work`}
              onClick={onToggle}
            />
          }
        >
          <BackgroundWorkMark presentation={view.presentation} seed={view.seed} />
        </TooltipTrigger>
        <TooltipPopup side="top">{label}</TooltipPopup>
      </Tooltip>
    </>
  );
}

/** @public — the drawer section, from plain props; Storybook draws it. */
export function ComposerBackgroundWorkSection(
  props: ComposerBackgroundWorkViewProps & { readonly onCollapse: () => void },
) {
  const label = resolveBackgroundWorkLabel(props);
  return (
    <div data-fork-background-work className="flex min-w-0 flex-col gap-1 px-3 pt-2.5 pb-2">
      <div className="flex min-w-0 items-center gap-2">
        <BackgroundWorkMark presentation={props.presentation} seed={props.seed} />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{label}</span>
        <button
          type="button"
          data-fork-monitoring-stop
          aria-label={props.stopping ? "Stopping background work" : "Stop background work"}
          disabled={props.stopping || !props.canStop}
          className="inline-flex h-6 shrink-0 cursor-pointer items-center gap-1.5 rounded-sm px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
          onClick={props.onStop}
        >
          <StopSquareIcon size={10} />
          <span>Stop</span>
        </button>
        <button
          type="button"
          aria-label="Hide background work"
          className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          onClick={props.onCollapse}
        >
          <ChevronDownIcon className="size-4" aria-hidden="true" />
        </button>
      </div>
      <ul data-fork-monitoring-tasks className="-mx-2 flex max-h-40 flex-col overflow-y-auto">
        {props.presentation.items.map((task) => (
          <BackgroundWorkTaskRow key={task.taskId} task={task} onOpenThread={props.onOpenThread} />
        ))}
      </ul>
    </div>
  );
}

function BackgroundWorkTaskRow(props: {
  readonly task: PendingBackgroundWorkItem;
  readonly onOpenThread: (threadId: ThreadId) => void;
}) {
  const { task } = props;
  const childThreadId = task.childThreadId;
  if (childThreadId === undefined) {
    return (
      <li className="flex">
        <span data-fork-monitoring-task aria-description={task.kind}>
          <span className="min-w-0 flex-1 truncate">{task.label}</span>
        </span>
      </li>
    );
  }
  return (
    <li className="flex">
      <button
        type="button"
        data-fork-monitoring-task
        aria-label={`Open ${task.label}`}
        onClick={() => props.onOpenThread(childThreadId)}
      >
        <span className="min-w-0 flex-1 truncate">{task.label}</span>
        <ChevronRightIcon aria-hidden className="size-3.5 shrink-0 opacity-60" />
      </button>
    </li>
  );
}
