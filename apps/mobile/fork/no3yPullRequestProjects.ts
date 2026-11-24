/**
 * The pull request list's project filter as a set — see
 * `.fork/customizations.yaml#no3y-pr-project-multiselect`. Controls saved before the set read their
 * single `projectId` as a one-project selection; every write stores the set and clears that pair.
 */
import { PULL_REQUEST_LIST_PROJECT_LIMIT } from "@t3tools/contracts";

import type { PullRequestListControls } from "../src/persistence/mobile-preferences";

export interface PullRequestProjectRef {
  readonly projectId: string;
  readonly environmentId: string;
}

export function pullRequestProjectSelection(
  controls: PullRequestListControls,
): ReadonlyArray<PullRequestProjectRef> {
  if (controls.projects) return controls.projects;
  return controls.projectId && controls.projectEnvironmentId
    ? [{ projectId: controls.projectId, environmentId: controls.projectEnvironmentId }]
    : [];
}

export function withPullRequestProjectSelection(
  controls: PullRequestListControls,
  selection: ReadonlyArray<PullRequestProjectRef>,
): PullRequestListControls {
  return {
    ...controls,
    projectId: undefined,
    projectEnvironmentId: undefined,
    projects: selection.length ? selection : undefined,
  };
}

const sameProject = (left: PullRequestProjectRef, right: PullRequestProjectRef) =>
  left.projectId === right.projectId && left.environmentId === right.environmentId;

export function pullRequestProjectSelected(
  selection: ReadonlyArray<PullRequestProjectRef>,
  project: PullRequestProjectRef,
) {
  return selection.some((selected) => sameProject(selected, project));
}

export function toggledPullRequestProject(
  selection: ReadonlyArray<PullRequestProjectRef>,
  project: PullRequestProjectRef,
): ReadonlyArray<PullRequestProjectRef> {
  return pullRequestProjectSelected(selection, project)
    ? selection.filter((selected) => !sameProject(selected, project))
    : [...selection, project].slice(0, PULL_REQUEST_LIST_PROJECT_LIMIT);
}

/** The selected projects one environment owns, or undefined when no project narrows the list. */
export function pullRequestProjectIdsFor(
  selection: ReadonlyArray<PullRequestProjectRef>,
  environmentId: string,
): ReadonlyArray<string> | undefined {
  if (!selection.length) return undefined;
  return selection
    .filter((project) => project.environmentId === environmentId)
    .map((project) => project.projectId);
}
