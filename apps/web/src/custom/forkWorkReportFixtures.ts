/** Fork-owned test fixture — see `.fork/customizations.yaml#fork-thread-launch-cards`. */
import {
  type ForkWorkRequestKind,
  RunId,
  RuntimeRequestId,
  ThreadId,
  TurnItemId,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";

import type { TimelineEntry } from "~/session-logic";

const AT = "2026-11-27T10:00:00.000Z";

/** A thread's work report notice, as the server writes it (fork-bot-work-reports): a finished
    run's, or with `request` the question or approval it waits on. */
export function workReportEntry(
  threadId: string,
  runId: string,
  request?: ForkWorkRequestKind,
): TimelineEntry {
  const reported = request === undefined ? `${runId}:completed` : "request-1";
  const id = `turn-item:message:${encodeURIComponent(
    `message:fork-bot-work-report:${threadId}:${reported}`,
  )}`;
  const summary =
    request === undefined
      ? `${threadId} finished`
      : `${threadId} ${request === "question" ? "has a question" : "needs an approval"}`;
  const time = DateTime.makeUnsafe(AT);
  const forkWorkReport = {
    threadId: ThreadId.make(threadId),
    ...(request === undefined
      ? {}
      : { request: { id: RuntimeRequestId.make(reported), kind: request } }),
  };
  return {
    id,
    kind: "work",
    createdAt: AT,
    entry: {
      id,
      createdAt: AT,
      runId: RunId.make(runId),
      label: summary,
      tone: "info",
      itemType: "notification",
      projectedItem: {
        position: 0,
        visibility: "local",
        sourceThreadId: ThreadId.make("parent"),
        sourceItemId: TurnItemId.make(id),
        item: {
          id: TurnItemId.make(id),
          threadId: ThreadId.make("parent"),
          runId: RunId.make(runId),
          nodeId: null,
          providerThreadId: null,
          providerTurnId: null,
          nativeItemRef: null,
          parentItemId: null,
          ordinal: 0,
          status: "completed",
          title: null,
          startedAt: time,
          completedAt: time,
          updatedAt: time,
          type: "notification",
          source: { kind: "system", forkWorkReport },
          outcome: "completed",
          summary,
        },
      },
    },
  };
}
