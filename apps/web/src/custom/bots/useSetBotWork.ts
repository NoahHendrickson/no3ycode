/** Giving a thread to a bot, or taking it back — see `.fork/customizations.yaml#fork-bot-crew`. */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { ThreadId } from "@t3tools/contracts";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { threadEnvironment } from "~/state/threads";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";

import { botCrewMessage, botWorkTagWrites } from "./botCrew";
import { botWorkOwnerId } from "./botWorkRoster";
import { useTellBot } from "./useTellBot";

/** Moves `thread` to `botId`'s work (null: to no bot's) and tells each bot what changed. */
export function useSetBotWork(): (
  thread: Pick<EnvironmentThreadShell, "environmentId" | "id" | "title" | "source">,
  botId: ThreadId | null,
) => Promise<void> {
  const setTag = useOrchestrationCommand(threadEnvironment.setTag);
  const tellBot = useTellBot();
  return async (thread, botId) => {
    const previous = botWorkOwnerId(thread.source);
    if (previous === botId) return;
    for (const write of botWorkTagWrites(thread.source, botId)) {
      const result = await setTag({
        environmentId: thread.environmentId,
        input: { threadId: thread.id, ...write },
      });
      if (result._tag !== "Success") return;
    }
    if (previous !== null)
      await tellBot(
        scopeThreadRef(thread.environmentId, previous),
        botCrewMessage(thread, "taken"),
      );
    if (botId !== null)
      await tellBot(scopeThreadRef(thread.environmentId, botId), botCrewMessage(thread, "given"));
  };
}
