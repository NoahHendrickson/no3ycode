/** The bots a sidebar lists in one environment — see `.fork/customizations.yaml#fork-bot-crew`. */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { ThreadId } from "@t3tools/contracts";

import { readThreadShells } from "~/state/entities";

import { listSidebarBots } from "./botThreads";

/** Oldest first, for the Petal submenu. Apart from botThreads, which the sidebar logic loads. */
export function readListedBots(
  environmentId: EnvironmentThreadShell["environmentId"],
): ReadonlyArray<{ readonly id: ThreadId; readonly title: string }> {
  return listSidebarBots(
    readThreadShells().filter((thread) => thread.environmentId === environmentId),
  ).map((bot) => ({ id: bot.id, title: bot.title }));
}
