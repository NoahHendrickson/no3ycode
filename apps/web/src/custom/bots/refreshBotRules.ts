/**
 * Bringing an existing bot's rules up to date — see `.fork/customizations.yaml#fork-bot-rules-refresh`.
 * A bot's CLAUDE.md is written when it is made and the bot cannot edit it, so rules added later
 * reach bots made earlier only through this.
 */
import type { FolderFiles } from "../hostFolderFiles";
import { refreshFolderRules } from "../refreshFolderRules";
import { BOT_RULES_VERSION, botRulesRefresh } from "./botSeedFiles";

/** A bot folder without CLAUDE.md gets the current rules too. */
export function refreshBotRules(
  files: FolderFiles,
  bot: { readonly name: string; readonly threadId: string },
): Promise<boolean> {
  return refreshFolderRules(files, {
    kind: "petal",
    version: BOT_RULES_VERSION,
    withoutRules: "write",
    refresh: () => botRulesRefresh(bot),
  });
}
