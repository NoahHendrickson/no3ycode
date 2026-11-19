/** Telling a bot something as its owner — see `.fork/customizations.yaml#fork-bot-crew`. */
import type { MessageId, ScopedThreadRef } from "@t3tools/contracts";

import { newMessageId } from "~/lib/utils";
import { readThreadShell } from "~/state/entities";
import { threadEnvironment } from "~/state/threads";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";

/** Queues `text` as the owner's message to the bot, behind whatever it is doing; false when it was
    not sent (the bot is gone or archived, or the command failed). */
export function useTellBot(): (
  botRef: ScopedThreadRef,
  text: string,
  messageId?: MessageId,
) => Promise<boolean> {
  const startTurn = useOrchestrationCommand(threadEnvironment.startTurn);
  return async (botRef, text, messageId = newMessageId()) => {
    const bot = readThreadShell(botRef);
    if (bot === null || bot.archivedAt !== null) return false;
    const result = await startTurn({
      environmentId: botRef.environmentId,
      input: {
        threadId: botRef.threadId,
        message: { messageId, role: "user", text, attachments: [] },
        runtimeMode: bot.runtimeMode,
        interactionMode: bot.interactionMode,
        // Behind whatever the bot is doing, never into it.
        dispatchMode: "queue",
        createdAt: new Date().toISOString(),
      },
    });
    return result._tag === "Success";
  };
}
