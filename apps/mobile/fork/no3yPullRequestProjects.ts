/**
 * The pull request list's project filter as a set — see
 * `.fork/customizations.yaml#no3y-pr-project-multiselect`. Saved controls are converted to the set
 * once, as preferences load, so everything downstream reads only `controls.projects`.
 */
import { PULL_REQUEST_LIST_PROJECT_LIMIT } from "@t3tools/contracts";

import type { PullRequestListControls } from "../src/persistence/mobile-preferences";

export interface PullRequestProjectRef {
  readonly projectId: string;
  readonly environmentId: string;
}

/** A single `projectId` saved before the set becomes a one-project set; the pair is dropped. */
export function withPullRequestProjectSet(
  controls: PullRequestListControls,
): PullRequestListControls {
  const { projectId, projectEnvironmentId, ...rest } = controls;
  if (projectId === undefined && projectEnvironmentId === undefined) return controls;
  return rest.projects || !projectId || !projectEnvironmentId
    ? rest
    : { ...rest, projects: [{ projectId, environmentId: projectEnvironmentId }] };
}

export function pullRequestProjectSelected(
  selection: ReadonlyArray<PullRequestProjectRef>,
  project: PullRequestProjectRef,
) {
  return selection.some(
    (selected) =>
      selected.projectId === project.projectId && selected.environmentId === project.environmentId,
  );
}

export function toggledPullRequestProject(
  selection: ReadonlyArray<PullRequestProjectRef>,
  project: PullRequestProjectRef,
): ReadonlyArray<PullRequestProjectRef> | undefined {
  const next = pullRequestProjectSelected(selection, project)
    ? selection.filter((selected) => !pullRequestProjectSelected([selected], project))
    : [...selection, project].slice(0, PULL_REQUEST_LIST_PROJECT_LIMIT);
  return next.length ? next : undefined;
}

/** Selected project ids by environment; empty when no project narrows the list. */
export function pullRequestProjectIdsByEnvironment(
  controls: PullRequestListControls,
): ReadonlyMap<string, ReadonlyArray<string>> {
  const byEnvironment = new Map<string, string[]>();
  for (const project of controls.projects ?? []) {
    const ids = byEnvironment.get(project.environmentId);
    if (ids) ids.push(project.projectId);
    else byEnvironment.set(project.environmentId, [project.projectId]);
  }
  return byEnvironment;
}
