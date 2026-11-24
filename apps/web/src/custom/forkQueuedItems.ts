/**
 * The queue card's item rule, shared by the card and its collapsed pill in the chip row.
 * See `.fork/customizations.yaml#fork-queued-runs-banner`.
 */

import { getUserQueuedThreadRuns } from "@t3tools/client-runtime/state/thread-workflows";

import type { ChatMessage } from "~/types";

type QueueProjection = Parameters<typeof getUserQueuedThreadRuns>[0];

/** Optimistic queued sends the server has not acknowledged yet. */
export function forkUnacknowledgedQueuedMessages<
  Message extends Pick<ChatMessage, "id" | "inputIntent">,
>(
  projection: QueueProjection | null | undefined,
  optimisticMessages: ReadonlyArray<Message>,
): ReadonlyArray<Message> {
  // Run-only acknowledgements can resurrect pending rows after cancellation or startup.
  const acknowledgedMessageIds = new Set((projection?.messages ?? []).map((message) => message.id));
  return optimisticMessages.filter(
    (message) => message.inputIntent === "queued_turn" && !acknowledgedMessageIds.has(message.id),
  );
}

/** How many rows the queue card shows: the server's queued runs plus unacknowledged sends. */
export function forkQueuedItemCount(
  projection: QueueProjection | null | undefined,
  optimisticMessages: ReadonlyArray<Pick<ChatMessage, "id" | "inputIntent">>,
): number {
  return (
    (projection ? getUserQueuedThreadRuns(projection).length : 0) +
    forkUnacknowledgedQueuedMessages(projection, optimisticMessages).length
  );
}
