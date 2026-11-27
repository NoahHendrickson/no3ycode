/**
 * Sprints — see `.fork/customizations.yaml#fork-sprints`. A sprint is a bot (tagged `bot`, so the
 * server links, briefs and reports its work as it does a Petal's) that also carries `sprint`,
 * belongs to a real project, and only acts when its owner or its own work speaks to it.
 *
 * No runtime imports from bots/botThreads here: botThreads reads this module.
 */
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { type EnvironmentId, ModelSelection, type ScopedThreadRef } from "@t3tools/contracts";
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

/** The sprints the Sprints section shows: all of them, or while it is folded the open one alone. */
export function visibleSidebarSprints<
  T extends { readonly environmentId: EnvironmentId; readonly id: ScopedThreadRef["threadId"] },
>(sprints: ReadonlyArray<T>, collapsed: boolean, routeThreadKey: string | null): T[] {
  return sprints.filter(
    (sprint) =>
      !collapsed ||
      routeThreadKey === scopedThreadKey(scopeThreadRef(sprint.environmentId, sprint.id)),
  );
}

/** The project a new sprint starts in: the open thread's, when there is one. */
export function sprintDefaultProject<
  T extends {
    readonly environmentId: EnvironmentId;
    readonly id: ScopedThreadRef["threadId"];
    readonly projectId: string;
  },
>(
  threads: ReadonlyArray<T>,
  routeThreadRef: ScopedThreadRef | null,
): { readonly environmentId: string; readonly projectId: string } | null {
  const routeThread =
    routeThreadRef === null
      ? undefined
      : threads.find(
          (thread) =>
            thread.environmentId === routeThreadRef.environmentId &&
            thread.id === routeThreadRef.threadId,
        );
  return routeThread === undefined
    ? null
    : { environmentId: routeThread.environmentId, projectId: routeThread.projectId };
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

/** Answers the owner gave the sprint's threads directly, from the cards in its conversation; the
    turn hook shows the sprint the file once it changes (its owner-edit marker). */
export const SPRINT_ANSWERS_FILE = "ANSWERS.md";

export interface SprintAnswer {
  readonly question: string;
  readonly answer: string;
}

/** One ANSWERS.md entry's text: each question on one line, an arrow, its answer as JSON; several
    joined by "; ". An approval's question is what it asked to do, its answer the decision. */
export function sprintAnswerLine(answers: ReadonlyArray<SprintAnswer>): string {
  return answers
    .map(
      (entry) => `${entry.question.replace(/\s+/g, " ").trim()} → ${JSON.stringify(entry.answer)}`,
    )
    .join("; ");
}

// A question, then its answer as a JSON string (which may hold "; "), or bare words written by hand.
const SPRINT_ANSWER = /(.+?) → ("(?:[^"\\]|\\.)*"|[^;]*)(?:; |$)/g;

/** The owner's latest answers to one request in the sprint's ANSWERS.md, keyed as its work report
    is (`threadId:requestId`), or null when there are none. */
export function sprintAnswersFor(
  log: string,
  reportKey: string,
): ReadonlyArray<SprintAnswer> | null {
  const marker = `(${reportKey}): `;
  const line = log
    .split("\n")
    .filter((entry) => entry.startsWith("- ") && entry.includes(marker))
    .at(-1);
  if (line === undefined) return null;
  const said = line.slice(line.indexOf(marker) + marker.length);
  const answers = [...said.matchAll(SPRINT_ANSWER)].map(([, question = "", raw = ""]) => {
    let answer = raw;
    if (raw.startsWith('"')) {
      try {
        answer = String(JSON.parse(raw));
      } catch {
        // Written by hand: keep the words.
      }
    }
    return { question, answer };
  });
  return answers.length === 0 ? null : answers;
}

/** One line in the sprint's ANSWERS.md for an answer the owner gave a thread directly; the log
    keeps the newest `keep` lines under its title. */
export function withSprintAnswer(log: string, line: string, keep = 20): string {
  const entries = log
    .split("\n")
    .filter((entry) => entry.startsWith("- "))
    .slice(-(keep - 1));
  return `# Answers\n\nYour owner answered these threads directly, from the sprint's conversation.\n\n${[...entries, `- ${line}`].join("\n")}\n`;
}

/** The marker an owner's save of `relativePath` leaves in SPRINT_OWNER_EDITS_DIRECTORY: one flat
    name per file, `/` written `__`, which the turn hook (sprintSeedFiles) turns back. */
export function sprintOwnerEditMarker(relativePath: string): string {
  return `${SPRINT_OWNER_EDITS_DIRECTORY}/${relativePath.replaceAll("/", "__")}`;
}
