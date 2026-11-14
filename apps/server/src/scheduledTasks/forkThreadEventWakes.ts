/**
 * Webhook tasks that also run on T3's own threads — see
 * `.fork/customizations.yaml#fork-bot-event-wakes`. A thread that finishes, fails or needs the
 * user posts a JSON event to each matching task's hook, so a bot can wake on its owner's other
 * threads with the webhook's filters, coalescing, rate limit and delivery log.
 */
import {
  isListedThreadLineage,
  type OrchestrationV2DomainEvent,
  type OrchestrationV2ThreadShell,
  type ScheduledTask,
  type ScheduledTaskThreadEventKind,
  type ScheduledTaskThreadEvents,
  type ThreadId,
} from "@t3tools/contracts";

import { FORK_BOT_THREAD_TAG } from "../orchestration-v2/forkBotReport.ts";

/** Must match the message ids ScheduledTaskService mints for every fire, webhook ones included. */
const SCHEDULED_TASK_MESSAGE_PREFIX = "scheduled-task-message:";
/** A GLOB over a thread's message ids that finds any message an automation sent into it. */
export const FORK_AUTOMATION_MESSAGE_GLOB = `${SCHEDULED_TASK_MESSAGE_PREFIX}*`;

export interface ForkThreadEvent {
  readonly kind: ScheduledTaskThreadEventKind;
  readonly threadId: ThreadId;
  readonly runId: string | null;
  readonly requestId: string | null;
}

/** A save's thread events: omitted keeps the stored ones, null clears them. */
export function forkThreadEventsToStore(
  input: ScheduledTaskThreadEvents | null | undefined,
  stored: ScheduledTaskThreadEvents | null | undefined,
): { readonly threadEvents?: ScheduledTaskThreadEvents } {
  const value = input === undefined ? stored : input;
  return value == null ? {} : { threadEvents: value };
}

/** The thread event a domain event is, if any: a run that completed or failed, or a request
    for the user's answer or approval that just opened. */
export function forkThreadEventFromDomainEvent(
  event: OrchestrationV2DomainEvent,
): ForkThreadEvent | null {
  if (event.type === "run.updated") {
    // A run an automation started never wakes one, so automations cannot wake each other.
    if (event.payload.userMessageId.startsWith(SCHEDULED_TASK_MESSAGE_PREFIX)) return null;
    const kind =
      event.payload.status === "completed"
        ? "finished"
        : event.payload.status === "failed"
          ? "failed"
          : null;
    return kind === null
      ? null
      : { kind, threadId: event.threadId, runId: event.payload.id, requestId: null };
  }
  if (
    event.type === "runtime-request.updated" &&
    event.payload.status === "pending" &&
    event.payload.kind !== "dynamic_tool_call" &&
    event.payload.kind !== "auth_refresh"
  ) {
    return {
      kind: "needs_you",
      threadId: event.threadId,
      runId: null,
      requestId: event.payload.id,
    };
  }
  return null;
}

/** Whether `event` on the thread `shell` wakes `task`. Never the task's own thread, a bot, a
    thread an agent spawned or one any automation has posted into, so nothing loops. */
export function forkThreadEventWakes(
  task: ScheduledTask,
  shell: Pick<
    OrchestrationV2ThreadShell,
    "id" | "projectId" | "tags" | "lineage" | "archivedAt"
  > | null,
  event: ForkThreadEvent,
  thread: { readonly automationThread: boolean },
): boolean {
  if (!task.enabled || task.schedule.type !== "webhook") return false;
  const config = task.schedule.threadEvents;
  if (config == null || !config.events.includes(event.kind)) return false;
  if (shell === null || shell.archivedAt !== null) return false;
  if (shell.id === task.threadId || shell.tags?.includes(FORK_BOT_THREAD_TAG) === true) {
    return false;
  }
  if (!isListedThreadLineage(shell.lineage) || thread.automationThread) return false;
  return config.projectIds == null || config.projectIds.length === 0
    ? true
    : config.projectIds.includes(shell.projectId);
}

/** The request body a task receives, and the delivery id that makes each event run it once. */
export function forkThreadEventDelivery(
  task: Pick<ScheduledTask, "id">,
  shell: Pick<OrchestrationV2ThreadShell, "id" | "title" | "projectId" | "lastError">,
  event: ForkThreadEvent,
): { readonly relayDeliveryId: string; readonly bodyText: string } {
  return {
    relayDeliveryId: `t3-thread-event:${task.id}:${event.threadId}:${event.runId ?? event.requestId ?? ""}:${event.kind}`,
    bodyText: JSON.stringify({
      event: event.kind,
      threadId: shell.id,
      title: shell.title,
      projectId: shell.projectId,
      ...(event.runId === null ? {} : { runId: event.runId }),
      ...(event.requestId === null ? {} : { requestId: event.requestId }),
      ...(event.kind === "failed" && shell.lastError != null ? { error: shell.lastError } : {}),
    }),
  };
}
