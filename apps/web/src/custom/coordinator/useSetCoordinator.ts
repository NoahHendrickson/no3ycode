/** Switching a thread's coordinating on or off — see
    `.fork/customizations.yaml#fork-coordinator-threads`. */
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { FORK_COORDINATOR_TAG, isForkCoordinatorThread } from "@t3tools/shared/forkBotTags";

import { threadEnvironment } from "~/state/threads";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";

import { useTellBot } from "../bots/useTellBot";
import {
  COORDINATOR_MENU_ID,
  COORDINATOR_START_MESSAGE,
  COORDINATOR_STOP_MESSAGE,
} from "./coordinatorThreads";

type CoordinatorThread = Pick<EnvironmentThreadShell, "environmentId" | "id" | "source">;

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
export function useSetCoordinator(): (thread: CoordinatorThread, on: boolean) => Promise<void> {
  const setTag = useOrchestrationCommand(threadEnvironment.setTag);
  const tell = useTellBot();
  return async (thread, on) => {
    if (isForkCoordinatorThread(thread.source) === on) return;
    await switchCoordinator(on, {
      setTag: (tagged) =>
        setTag({
          environmentId: thread.environmentId,
          input: { threadId: thread.id, tag: FORK_COORDINATOR_TAG, tagged },
        }),
      tell: () =>
        tell(
          scopeThreadRef(thread.environmentId, thread.id),
          on ? COORDINATOR_START_MESSAGE : COORDINATOR_STOP_MESSAGE,
        ),
    });
  };
}

/** The thread menus' pick of the switch (the sidebar's and the chat header's): true when `id` is
    it, and then flips the thread's coordinating once the menu's own operate check passes. */
export function useCoordinatorMenuPick(): (
  id: string,
  thread: CoordinatorThread,
  canOperate: () => boolean,
) => id is typeof COORDINATOR_MENU_ID {
  const setCoordinator = useSetCoordinator();
  return (id, thread, canOperate): id is typeof COORDINATOR_MENU_ID => {
    if (id !== COORDINATOR_MENU_ID) return false;
    if (canOperate()) void setCoordinator(thread, !isForkCoordinatorThread(thread.source));
    return true;
  };
}
