/** Whether a thread is a sprint — see `.fork/customizations.yaml#fork-sprints`. */
import type { ScopedThreadRef } from "@t3tools/contracts";

import { useQuietThreadShell } from "~/state/entities";

import { isSprintThread } from "./sprintThreads";

export function useIsSprintThread(ref: ScopedThreadRef | null): boolean {
  const shell = useQuietThreadShell(ref);
  return shell !== null && isSprintThread(shell.source);
}
