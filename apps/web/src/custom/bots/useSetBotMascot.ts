/** Changing a bot's mascot after it was made — see `.fork/customizations.yaml#fork-bots`. */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";

import { threadEnvironment } from "~/state/threads";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";

import { type BotMascotShape, botMascotTagWrites } from "./botMascots";

export function useSetBotMascot(): (
  thread: Pick<EnvironmentThreadShell, "environmentId" | "id" | "source">,
  shape: BotMascotShape,
) => Promise<void> {
  const setTag = useOrchestrationCommand(threadEnvironment.setTag);
  return async (thread, shape) => {
    for (const write of botMascotTagWrites(thread, shape)) {
      const result = await setTag({
        environmentId: thread.environmentId,
        input: { threadId: thread.id, ...write },
      });
      if (result._tag !== "Success") return;
    }
  };
}
