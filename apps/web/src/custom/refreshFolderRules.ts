/**
 * Bringing a Petal's or a sprint's rules up to date — see `.fork/customizations.yaml`
 * `#fork-bot-rules-refresh` and `#fork-sprint-rules-refresh`. CLAUDE.md is written when the folder
 * is made and its agent cannot edit it, so rules added later reach folders made earlier only here.
 */
import type { FolderFiles } from "./hostFolderFiles";

export interface RulesSeedFile {
  readonly relativePath: string;
  readonly contents: string;
}

/** What an out-of-date folder gets: the files only T3 Code writes are replaced, the files its agent
    and owner keep are added only where missing, and `rules`, CLAUDE.md's new text, goes last. */
export interface FolderRulesRefresh {
  readonly rules: string;
  readonly replace: ReadonlyArray<RulesSeedFile>;
  readonly addIfMissing: ReadonlyArray<RulesSeedFile>;
}

const RULES_FILE = "CLAUDE.md";

/** The version a CLAUDE.md declares on its first line; one without a marker is the oldest. */
function rulesVersion(kind: string, contents: string): number {
  const marker = new RegExp(`^<!-- ${kind}-rules: (\\d+) -->`).exec(contents);
  return marker?.[1] === undefined ? 1 : Number(marker[1]);
}

/** Where the replaced CLAUDE.md is kept, one copy per version, in case its owner edited it. */
export function previousRulesFile(version: number): string {
  return `.claude/CLAUDE.v${version}.md`;
}

/** Refreshes one folder when its CLAUDE.md, marked `<!-- <kind>-rules: N -->`, is older than
    `version`; a newer one, written by a newer client, is left alone. Resolves to whether it wrote
    anything. A failed read or write stops it before CLAUDE.md, whose marker says the refresh
    finished, so a later attempt starts over. */
export async function refreshFolderRules(
  files: FolderFiles,
  options: {
    readonly kind: "petal" | "sprint";
    readonly version: number;
    /** `leave` skips a folder with no CLAUDE.md; `write` gives it the current rules. */
    readonly withoutRules: "leave" | "write";
    /** `current` is the CLAUDE.md being replaced, null when there is none. */
    readonly refresh: (current: string | null) => FolderRulesRefresh;
  },
): Promise<boolean> {
  const current = await files.read(RULES_FILE);
  if (current === null && options.withoutRules === "leave") return false;
  const version = current === null ? null : rulesVersion(options.kind, current);
  if (version !== null && version >= options.version) return false;
  const { rules, replace, addIfMissing } = options.refresh(current);
  if (current !== null && version !== null) await files.write(previousRulesFile(version), current);
  for (const file of addIfMissing) {
    if ((await files.read(file.relativePath)) === null) {
      await files.write(file.relativePath, file.contents);
    }
  }
  for (const file of replace) await files.write(file.relativePath, file.contents);
  await files.write(RULES_FILE, rules);
  return true;
}
