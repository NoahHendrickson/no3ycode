/**
 * Bringing an existing sprint's rules up to date — see
 * `.fork/customizations.yaml#fork-sprint-rules-refresh`. Only the files SPRINT_FILE_OWNERSHIP
 * marks generated are rewritten; what the owner and the sprint keep is only ever added.
 */
import type { BotFolderFiles } from "../bots/refreshBotRules";
import {
  parseSprintOtherProjects,
  SPRINT_FILE_OWNERSHIP,
  SPRINT_RULES_UPDATED_MARKER,
  SPRINT_RULES_VERSION,
  type SprintIdentity,
  sprintSeedFiles,
} from "./sprintSeedFiles";

/** The rules version a CLAUDE.md declares on its first line; one without a marker is the oldest. */
function sprintRulesVersion(contents: string): number {
  const marker = /^<!-- sprint-rules: (\d+) -->/.exec(contents);
  return marker?.[1] === undefined ? 1 : Number(marker[1]);
}

/** Where the replaced CLAUDE.md is kept, one copy per version. */
export function sprintPreviousRulesFile(version: number): string {
  return `.claude/CLAUDE.v${version}.md`;
}

export function sprintFileOwner(relativePath: string): "generated" | "owned" | null {
  const entry = SPRINT_FILE_OWNERSHIP.find((candidate) =>
    candidate.relativePath.endsWith("/")
      ? relativePath.startsWith(candidate.relativePath)
      : relativePath === candidate.relativePath,
  );
  return entry?.owner ?? null;
}

/** Refreshes one sprint's folder when its CLAUDE.md is older than the current rules; a newer one,
    written by a newer client, is left alone, and so is a folder without one, whose sprint is still
    being seeded. Resolves to whether it wrote anything. A failed read or write stops it before
    CLAUDE.md, whose marker says the refresh finished, so a later attempt starts over. */
export async function refreshSprintRules(
  files: BotFolderFiles,
  sprint: SprintIdentity,
): Promise<boolean> {
  const current = await files.read("CLAUDE.md");
  if (current === null) return false;
  const version = sprintRulesVersion(current);
  if (version >= SPRINT_RULES_VERSION) return false;
  const seeded = sprintSeedFiles({
    ...sprint,
    // Only used where PROJECTS.md is missing: rules before it listed the projects themselves.
    otherProjects: parseSprintOtherProjects(current),
    goal: "",
    threadModel: null,
    today: new Date().toISOString().slice(0, 10),
  });
  await files.write(sprintPreviousRulesFile(version), current);
  let rules = "";
  for (const file of seeded) {
    const owner = sprintFileOwner(file.relativePath);
    if (file.relativePath === "CLAUDE.md") rules = file.contents;
    else if (owner === "generated") await files.write(file.relativePath, file.contents);
    else if (owner === "owned" && (await files.read(file.relativePath)) === null) {
      await files.write(file.relativePath, file.contents);
    }
  }
  await files.write(SPRINT_RULES_UPDATED_MARKER, `${new Date().toISOString()}\n`);
  // CLAUDE.md last: its marker is what says the refresh finished.
  await files.write("CLAUDE.md", rules);
  return true;
}
