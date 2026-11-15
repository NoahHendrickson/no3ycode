/**
 * Bringing an existing bot's rules up to date — see `.fork/customizations.yaml#fork-bot-rules-refresh`.
 * A bot's CLAUDE.md is written when it is made and the bot cannot edit it, so rules added later
 * reach bots made earlier only through this.
 */
import { BOT_RULES_VERSION, botRulesRefresh } from "./botSeedFiles";

/** The rules version a CLAUDE.md declares on its first line; one without a marker predates them. */
function botRulesVersion(contents: string): number {
  const marker = /^<!-- petal-rules: (\d+) -->/.exec(contents);
  return marker?.[1] === undefined ? 1 : Number(marker[1]);
}

/** Where the replaced CLAUDE.md is kept, one copy per version, in case its owner edited it. */
export function botPreviousRulesFile(version: number): string {
  return `.claude/CLAUDE.v${version}.md`;
}

/** File access in the bot's folder: `read` is null for a missing file and throws on failure;
    `write` throws on failure. */
export interface BotFolderFiles {
  readonly read: (relativePath: string) => Promise<string | null>;
  readonly write: (relativePath: string, contents: string) => Promise<void>;
}

/** Refreshes one bot's folder when its CLAUDE.md is older than the current rules; a newer one,
    written by a newer client, is left alone. Resolves to whether it wrote anything. A failed read
    or write stops it before CLAUDE.md, whose marker says the refresh finished, so a later attempt
    starts over. */
export async function refreshBotRules(
  files: BotFolderFiles,
  bot: { readonly name: string; readonly threadId: string },
): Promise<boolean> {
  const current = await files.read("CLAUDE.md");
  const version = current === null ? null : botRulesVersion(current);
  if (version !== null && version >= BOT_RULES_VERSION) return false;
  const { replace, addIfMissing } = botRulesRefresh(bot);
  if (current !== null && version !== null) {
    await files.write(botPreviousRulesFile(version), current);
  }
  for (const file of addIfMissing) {
    if ((await files.read(file.relativePath)) === null) {
      await files.write(file.relativePath, file.contents);
    }
  }
  for (const file of replace) await files.write(file.relativePath, file.contents);
  return true;
}
