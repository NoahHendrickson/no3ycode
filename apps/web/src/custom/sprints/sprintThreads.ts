/**
 * Sprints — see `.fork/customizations.yaml#fork-sprints`. A sprint is a bot (tagged `bot`, so the
 * server links, briefs and reports its work as it does a Petal's) that also carries `sprint`,
 * belongs to a real project, and only acts when its owner or its own work speaks to it.
 *
 * No runtime imports from bots/botThreads here: botThreads reads this module.
 */
import { ModelSelection } from "@t3tools/contracts";
import { isForkBotThread } from "@t3tools/shared/forkBotTags";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

/** The second tag that makes a bot a sprint. A subagent inherits it without `bot`, so a sprint
    is always both. */
export const FORK_SPRINT_TAG = "sprint";
/** Where sprint folders live, relative to the No-project workspace root, beside `bots`. */
export const SPRINT_FOLDERS_DIRECTORY = "sprints";
/** The sprint's plan: its goal on the first line under the title, then its phases. */
export const SPRINT_PLAN_FILE = "PLAN.md";
/** What the sprint and every thread it starts should know; threads read it first and add to it. */
export const SPRINT_MEMORY_FILE = "MEMORY.md";
/** One empty marker per file the owner saved from the panel; the turn hook shows the sprint that
    file's new text and removes the marker. */
export const SPRINT_OWNER_EDITS_DIRECTORY = ".claude/owner-edits";

export function isSprintThread(shell: {
  readonly tags?: ReadonlyArray<string> | undefined;
}): boolean {
  return isForkBotThread(shell.tags) && shell.tags?.includes(FORK_SPRINT_TAG) === true;
}

/** Sprints the sidebar lists, oldest first so a sprint keeps its place. */
export function listSidebarSprints<
  T extends {
    readonly archivedAt: string | null;
    readonly createdAt: string;
    readonly source: { readonly tags?: ReadonlyArray<string> | undefined };
  },
>(threads: ReadonlyArray<T>): T[] {
  return threads
    .filter((thread) => thread.archivedAt === null && isSprintThread(thread.source))
    .toSorted((left, right) => left.createdAt.localeCompare(right.createdAt));
}

const NO_GOAL = "Not set.";

/** The goal line PLAN.md starts with. */
export function sprintGoalLine(goal: string): string {
  const line = goal.replace(/\s+/g, " ").trim();
  return `Goal: ${line === "" ? NO_GOAL : line}`;
}

const GOAL_LINE = /^\s*[-*]?\s*(?:\*\*|__)?Goal:(?:\*\*|__)?\s*(.*)$/i;

/** The sprint's goal from PLAN.md: its first `Goal:` line, or null when it has none or it is not
    set. Markdown emphasis around the label is allowed, since the sprint rewrites the file. */
export function parseSprintGoal(plan: string): string | null {
  for (const raw of plan.split("\n")) {
    const match = GOAL_LINE.exec(raw);
    if (match === null) continue;
    const goal = (match[1] ?? "").trim();
    return goal === "" || goal.toLowerCase() === NO_GOAL.toLowerCase() ? null : goal;
  }
  return null;
}

/** PLAN.md with its goal set: the first `Goal:` line rewritten, or, when the sprint dropped it, a
    new one under the title. The rest of the file is the sprint's and stays as it is. */
export function withSprintGoal(plan: string, goal: string): string {
  const lines = plan.split("\n");
  const at = lines.findIndex((line) => GOAL_LINE.test(line));
  if (at !== -1) return lines.toSpliced(at, 1, sprintGoalLine(goal)).join("\n");
  const title = lines.findIndex((line) => line.startsWith("# "));
  return title === -1
    ? `${sprintGoalLine(goal)}\n\n${plan}`
    : lines.toSpliced(title + 1, 0, "", sprintGoalLine(goal)).join("\n");
}

const NO_THREAD_MODEL =
  "not set. Ask your owner which model the work should run on, then write it here as a modelSelection.";

/** PLAN.md's `Thread model:` line: the selection as JSON in backticks, which the sprint passes to
    `t3_thread_launch` as `modelSelection`, or a note to ask. */
export function sprintThreadModelLine(selection: ModelSelection | null): string {
  return `Thread model: ${selection === null ? NO_THREAD_MODEL : `\`${JSON.stringify(selection)}\``}`;
}

const THREAD_MODEL_LINE = /^\s*[-*]?\s*(?:\*\*|__)?Thread model:(?:\*\*|__)?\s*(.*)$/i;
const PACE_LINE = /^\s*[-*]?\s*(?:\*\*|__)?Pace:/i;
const decodeModelSelection = Schema.decodeUnknownOption(ModelSelection);

/** The model PLAN.md's first `Thread model:` line holds, or null when it has none, is not set or
    does not parse. */
export function parseSprintThreadModel(plan: string): ModelSelection | null {
  for (const raw of plan.split("\n")) {
    const match = THREAD_MODEL_LINE.exec(raw);
    if (match === null) continue;
    const json = /\{.*\}/.exec(match[1] ?? "")?.[0];
    if (json === undefined) return null;
    try {
      return Option.getOrNull(decodeModelSelection(JSON.parse(json)));
    } catch {
      return null;
    }
  }
  return null;
}

/** PLAN.md with its thread model set: the first `Thread model:` line rewritten, or, when the sprint
    dropped it, a new one after the Pace line (else the Goal line, else on top). */
export function withSprintThreadModel(plan: string, selection: ModelSelection): string {
  const lines = plan.split("\n");
  const line = sprintThreadModelLine(selection);
  const at = lines.findIndex((candidate) => THREAD_MODEL_LINE.test(candidate));
  if (at !== -1) return lines.toSpliced(at, 1, line).join("\n");
  const pace = lines.findIndex((candidate) => PACE_LINE.test(candidate));
  if (pace !== -1) return lines.toSpliced(pace + 1, 0, line).join("\n");
  const goal = lines.findIndex((candidate) => GOAL_LINE.test(candidate));
  return goal === -1 ? `${line}\n\n${plan}` : lines.toSpliced(goal + 1, 0, "", line).join("\n");
}

/** `folderName` comes from bots/botThreads botFolderName. Joined with the root's own separator:
    the path is the server's, not the browser's. */
export function sprintFolderPath(scratchWorkspaceRoot: string, folderName: string): string {
  const separator = scratchWorkspaceRoot.includes("\\") ? "\\" : "/";
  const root = scratchWorkspaceRoot.replace(/[\\/]+$/, "");
  return [root, SPRINT_FOLDERS_DIRECTORY, folderName].join(separator);
}
