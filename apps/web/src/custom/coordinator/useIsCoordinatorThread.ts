/** Whether a thread is a coordinator — see `.fork/customizations.yaml#fork-coordinator-threads`. */
import type { ScopedThreadRef } from "@t3tools/contracts";

import { useQuietThreadShell } from "~/state/entities";

import { isCoordinatorThread } from "./coordinatorThreads";

export function useIsCoordinatorThread(ref: ScopedThreadRef | null): boolean {
  const shell = useQuietThreadShell(ref);
  return shell !== null && isCoordinatorThread(shell.source);
}
