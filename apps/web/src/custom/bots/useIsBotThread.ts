/** Whether a thread is a bot — see `.fork/customizations.yaml#fork-bots`. */
import type { ScopedThreadRef } from "@t3tools/contracts";

import { useQuietThreadShell } from "~/state/entities";

import { isBotThread } from "./botThreads";

export function useIsBotThread(ref: ScopedThreadRef | null): boolean {
  const shell = useQuietThreadShell(ref);
  return shell !== null && isBotThread(shell.source);
}
