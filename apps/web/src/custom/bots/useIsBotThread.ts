/** Whether a thread is a bot — see `.fork/customizations.yaml#fork-bots`. */
import type { ScopedThreadRef } from "@t3tools/contracts";

import { appAtomRegistry } from "~/rpc/atomRegistry";
import { useQuietThreadShell } from "~/state/entities";
import { environmentThreadShells } from "~/state/threads";

import { isBotThread } from "./botThreads";

export function useIsBotThread(ref: ScopedThreadRef | null): boolean {
  const shell = useQuietThreadShell(ref);
  return shell !== null && isBotThread(shell.source);
}

/** For a handler, which reads the thread as it is when it runs. */
export function isBotThreadRef(ref: ScopedThreadRef): boolean {
  const shell = appAtomRegistry.get(environmentThreadShells.quietThreadShellAtom(ref));
  return shell !== null && isBotThread(shell.source);
}
