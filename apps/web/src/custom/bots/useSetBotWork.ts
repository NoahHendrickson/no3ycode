/** Giving a thread to a bot, or taking it back — see `.fork/customizations.yaml#fork-bot-crew`. */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { ThreadId } from "@t3tools/contracts";
import { newMessageId } from "~/lib/utils";
import { readThreadShell, readThreadShells } from "~/state/entities";
import { threadEnvironment } from "~/state/threads";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";

import { botCrewMessage, botWorkTagWrites } from "./botCrew";
import { listSidebarBots } from "./botThreads";
import { botWorkOwnerId } from "./botWorkRoster";

/** Moves `thread` to `botId`'s work (null: to no bot's) and tells each bot what changed. */
export function useSetBotWork(): (
  thread: Pick<EnvironmentThreadShell, "environmentId" | "id" | "title" | "source">,
  botId: ThreadId | null,
) => Promise<void> {
  const setTag = useOrchestrationCommand(threadEnvironment.setTag);
  const startTurn = useOrchestrationCommand(threadEnvironment.startTurn);
  const tell = async (
    environmentId: EnvironmentThreadShell["environmentId"],
    botId: ThreadId,
    text: string,
  ) => {
    const bot = readThreadShell({ environmentId, threadId: botId });
    if (bot === null || bot.archivedAt !== null) return;
    await startTurn({
      environmentId,
      input: {
        threadId: botId,
        message: { messageId: newMessageId(), role: "user", text, attachments: [] },
        runtimeMode: bot.runtimeMode,
        interactionMode: bot.interactionMode,
        // Behind whatever the bot is doing, never into it.
        dispatchMode: "queue",
        createdAt: new Date().toISOString(),
      },
    });
  };
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
      await tell(thread.environmentId, previous, botCrewMessage(thread, "taken"));
    if (botId !== null) await tell(thread.environmentId, botId, botCrewMessage(thread, "given"));
  };
}

/** The bots `environmentId`'s sidebar lists, oldest first, for the Petal submenu. */
export function readListedBots(
  environmentId: EnvironmentThreadShell["environmentId"],
): ReadonlyArray<{ readonly id: ThreadId; readonly title: string }> {
  return listSidebarBots(
    readThreadShells().filter((thread) => thread.environmentId === environmentId),
  ).map((bot) => ({ id: bot.id, title: bot.title }));
}
