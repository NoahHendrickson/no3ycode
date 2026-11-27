/** Runs refreshBotRules once a session for each listed bot — see `#fork-bot-rules-refresh`. */
import type { EnvironmentId } from "@t3tools/contracts";

import { quietFolderFiles } from "../hostFolderFiles";
import { useRefreshFolderRules } from "../useRefreshFolderRules";
import { refreshBotRules } from "./refreshBotRules";

interface RefreshableBot {
  readonly environmentId: EnvironmentId;
  readonly id: string;
  readonly title: string;
  readonly worktreePath: string | null;
}

export function useRefreshBotRules(bots: ReadonlyArray<RefreshableBot>): void {
  useRefreshFolderRules(bots, (bot, registry) =>
    bot.worktreePath === null
      ? null
      : refreshBotRules(
          quietFolderFiles(registry, { environmentId: bot.environmentId, cwd: bot.worktreePath }),
          { name: bot.title, threadId: bot.id },
        ),
  );
}
