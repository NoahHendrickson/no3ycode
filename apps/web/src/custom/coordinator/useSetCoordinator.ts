/** Switching a thread's coordinating on or off — see
    `.fork/customizations.yaml#fork-coordinator-threads`. */
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";

import { threadEnvironment } from "~/state/threads";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";

import { useTellBot } from "../bots/useTellBot";
import {
  coordinatorMessage,
  FORK_COORDINATOR_TAG,
  isCoordinatorThread,
} from "./coordinatorThreads";

/** Tags or untags the thread, then tells it, behind whatever it is doing. */
export function useSetCoordinator(): (
  thread: Pick<EnvironmentThreadShell, "environmentId" | "id" | "source">,
  on: boolean,
) => Promise<void> {
  const setTag = useOrchestrationCommand(threadEnvironment.setTag);
  const tell = useTellBot();
  return async (thread, on) => {
    if (isCoordinatorThread(thread.source) === on) return;
    const result = await setTag({
      environmentId: thread.environmentId,
      input: { threadId: thread.id, tag: FORK_COORDINATOR_TAG, tagged: on },
    });
    if (result._tag !== "Success") return;
    await tell(scopeThreadRef(thread.environmentId, thread.id), coordinatorMessage(on));
  };
}
