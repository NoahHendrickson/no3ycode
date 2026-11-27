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

/** Tags or untags the thread, then tells it. When the telling fails the tag goes back, so the
    thread never coordinates without its rules or keeps them untagged (each command reports its
    own failure). */
export async function switchCoordinator(
  on: boolean,
  steps: {
    readonly setTag: (tagged: boolean) => Promise<{ readonly _tag: string }>;
    readonly tell: () => Promise<boolean>;
  },
): Promise<void> {
  if ((await steps.setTag(on))._tag !== "Success") return;
  if (!(await steps.tell())) await steps.setTag(!on);
}

/** Tags or untags the thread, then tells it, behind whatever it is doing. */
export function useSetCoordinator(): (
  thread: Pick<EnvironmentThreadShell, "environmentId" | "id" | "source">,
  on: boolean,
) => Promise<void> {
  const setTag = useOrchestrationCommand(threadEnvironment.setTag);
  const tell = useTellBot();
  return async (thread, on) => {
    if (isCoordinatorThread(thread.source) === on) return;
    await switchCoordinator(on, {
      setTag: (tagged) =>
        setTag({
          environmentId: thread.environmentId,
          input: { threadId: thread.id, tag: FORK_COORDINATOR_TAG, tagged },
        }),
      tell: () => tell(scopeThreadRef(thread.environmentId, thread.id), coordinatorMessage(on)),
    });
  };
}
