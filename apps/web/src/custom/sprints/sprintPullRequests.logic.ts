/**
 * A sprint's Pull requests tab — see `.fork/customizations.yaml#fork-sprints`. Every pull request
 * of the threads the sprint started (the ones its Threads tab lists), what needs the owner first.
 */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";

import { threadParentOf } from "../bots/botWorkRoster";
import {
  type ThreadLaunchPullRequest,
  type ThreadPullRequestStage,
  threadLaunchPullRequests,
} from "../threadLaunchCards/threadLaunch.logic";

export interface SprintPullRequest extends ThreadLaunchPullRequest {
  readonly thread: EnvironmentThreadShell;
}

/** Failing checks and merge-ready PRs ask the owner something; finished ones sink. */
const STAGE_ORDER: ReadonlyArray<ThreadPullRequestStage | null> = [
  "checks-failing",
  "ready",
  "checks-running",
  null,
  "draft",
  "merged",
  "closed",
];

export function sprintPullRequests(
  threads: ReadonlyArray<EnvironmentThreadShell>,
  sprint: { readonly environmentId: string; readonly threadId: string },
): ReadonlyArray<SprintPullRequest> {
  const seen = new Set<string>();
  const rows: SprintPullRequest[] = [];
  const work = threads
    .filter(
      (thread) =>
        thread.environmentId === sprint.environmentId &&
        thread.archivedAt === null &&
        threadParentOf(thread)?.threadId === sprint.threadId,
    )
    .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  for (const thread of work) {
    for (const pr of threadLaunchPullRequests(thread)) {
      if (seen.has(pr.url)) continue;
      seen.add(pr.url);
      rows.push({ ...pr, thread });
    }
  }
  // A stable sort keeps the newest thread's first within a stage.
  return rows.toSorted(
    (left, right) => STAGE_ORDER.indexOf(left.stage) - STAGE_ORDER.indexOf(right.stage),
  );
}
