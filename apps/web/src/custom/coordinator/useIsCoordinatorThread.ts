/** Whether a thread is a coordinator — see `.fork/customizations.yaml#fork-coordinator-threads`. */
import type { ScopedThreadRef } from "@t3tools/contracts";
import { isForkCoordinatorThread } from "@t3tools/shared/forkBotTags";

import { useQuietThreadShell } from "~/state/entities";

export function useIsCoordinatorThread(ref: ScopedThreadRef | null): boolean {
  const shell = useQuietThreadShell(ref);
  return shell !== null && isForkCoordinatorThread(shell.source);
}
