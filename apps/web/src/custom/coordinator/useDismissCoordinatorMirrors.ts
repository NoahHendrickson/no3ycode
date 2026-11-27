/** Dismisses a coordinator's re-ask of a child's question — see coordinatorMirrors and
    `.fork/customizations.yaml#fork-coordinator-threads`. */
import { RuntimeRequestId, type ScopedThreadRef } from "@t3tools/contracts";
import { useEffect, useRef } from "react";

import { threadEnvironment } from "~/state/threads";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";

import { coordinatorMirroredQuestions } from "./coordinatorMirrors";

export function useDismissCoordinatorMirrors(
  coordinatorRef: ScopedThreadRef | null,
  pending: Parameters<typeof coordinatorMirroredQuestions>[0],
  turnItems: Parameters<typeof coordinatorMirroredQuestions>[1],
): void {
  const dismiss = useOrchestrationCommand(threadEnvironment.dismissUserInput, {
    reportFailure: false,
  });
  const sent = useRef(new Set<string>());
  const environmentId = coordinatorRef?.environmentId ?? null;
  const threadId = coordinatorRef?.threadId ?? null;
  const mirroredKey =
    coordinatorRef === null ? "" : coordinatorMirroredQuestions(pending, turnItems).join("\n");
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- cancels on the server a coordinator's duplicate of a child's question, which the child's card answers
  useEffect(() => {
    if (environmentId === null || threadId === null || mirroredKey === "") return;
    for (const requestId of mirroredKey.split("\n")) {
      if (sent.current.has(requestId)) continue;
      sent.current.add(requestId);
      void dismiss({
        environmentId,
        input: { threadId, requestId: RuntimeRequestId.make(requestId) },
      });
    }
  }, [environmentId, threadId, mirroredKey, dismiss]);
}
