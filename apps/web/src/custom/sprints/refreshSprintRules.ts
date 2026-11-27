/**
 * Bringing an existing sprint's rules up to date — see
 * `.fork/customizations.yaml#fork-sprint-rules-refresh`. Only what sprintRulesRefresh replaces is
 * rewritten; what the owner and the sprint keep is only ever added.
 */
import type { FolderFiles } from "../hostFolderFiles";
import { refreshFolderRules } from "../refreshFolderRules";
import {
  SPRINT_RULES_VERSION,
  type SprintIdentity,
  type SprintOtherProject,
  sprintRulesRefresh,
} from "./sprintSeedFiles";

const LISTED_PROJECT = /^- (.+) \(id `([^`]+)`, at `([^`]+)`\)$/;

/** Migration from rules version 5 and older, which listed the other projects in CLAUDE.md itself:
    the list moves into the PROJECTS.md the refresh adds. Later rules list none, so this finds none. */
function projectsListedInOldRules(rules: string): ReadonlyArray<SprintOtherProject> {
  return rules.split("\n").flatMap((line) => {
    const match = LISTED_PROJECT.exec(line);
    return match === null
      ? []
      : [{ title: match[1] ?? "", id: match[2] ?? "", root: match[3] ?? "" }];
  });
}

/** A folder with no CLAUDE.md is left alone: its sprint is still being seeded. */
export function refreshSprintRules(files: FolderFiles, sprint: SprintIdentity): Promise<boolean> {
  return refreshFolderRules(files, {
    kind: "sprint",
    version: SPRINT_RULES_VERSION,
    withoutRules: "leave",
    refresh: (current) => sprintRulesRefresh(sprint, projectsListedInOldRules(current ?? "")),
  });
}
