/**
 * Bringing an existing bot's rules up to date — see `.fork/customizations.yaml#fork-bot-rules-refresh`.
 * A bot's CLAUDE.md is written when it is made and the bot cannot edit it, so rules added later
 * reach bots made earlier only through this.
 */
import { BOT_RULES_MARKER, botRulesRefresh } from "./botSeedFiles";

/** Where the replaced CLAUDE.md is kept, in case its owner had edited it by hand. */
export const BOT_PREVIOUS_RULES_FILE = ".claude/CLAUDE.previous.md";

/** File access in the bot's folder: `read` is null for a missing file and throws on failure;
    `write` throws on failure. */
export interface BotFolderFiles {
  readonly read: (relativePath: string) => Promise<string | null>;
  readonly write: (relativePath: string, contents: string) => Promise<void>;
}

/** Refreshes one bot's folder when its CLAUDE.md predates the current rules. Resolves to whether
    it wrote anything. A failed read or write stops it before CLAUDE.md, whose marker says the
    refresh finished, so a later attempt starts over. */
export async function refreshBotRules(
  files: BotFolderFiles,
  bot: { readonly name: string; readonly threadId: string },
): Promise<boolean> {
  const current = await files.read("CLAUDE.md");
  if (current?.startsWith(BOT_RULES_MARKER)) return false;
  const { replace, addIfMissing } = botRulesRefresh(bot);
  if (current !== null) await files.write(BOT_PREVIOUS_RULES_FILE, current);
  for (const file of addIfMissing) {
    if ((await files.read(file.relativePath)) === null) {
      await files.write(file.relativePath, file.contents);
    }
  }
  for (const file of replace) await files.write(file.relativePath, file.contents);
  return true;
}
