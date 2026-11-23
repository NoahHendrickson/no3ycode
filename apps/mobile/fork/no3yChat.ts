/**
 * The Chat tab's draft rules: the No-project workspace a new chat starts in and the draft the tab
 * keeps for it — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 */
import { isScratchProject } from "@t3tools/client-runtime/state/projects";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import type { EnvironmentId } from "@t3tools/contracts";

import type { NewTaskDraftRouteParams } from "../src/features/threads/thread-route-state";

/** The opened No-project workspace a new chat starts in, or null until it is listed. */
export function findNo3yChatProject(input: {
  readonly environmentId: EnvironmentId | null;
  readonly projects: ReadonlyArray<EnvironmentProject>;
  readonly scratchWorkspaceRoot: string | null | undefined;
}): EnvironmentProject | null {
  if (input.environmentId === null) return null;
  return (
    input.projects.find(
      (project) =>
        project.environmentId === input.environmentId &&
        isScratchProject(project, input.scratchWorkspaceRoot),
    ) ?? null
  );
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * The draft the Chat tab should keep: its own while it still names the chat's project, a
 * fresh one for that project otherwise (and after each send), none while there is no project.
 */
export function resolveNo3yChatDraftParams(
  current: NewTaskDraftRouteParams | undefined,
  project: Pick<EnvironmentProject, "environmentId" | "id"> | null,
  makeRequestId: () => string,
): NewTaskDraftRouteParams | null {
  if (project === null) return null;
  if (
    current !== undefined &&
    first(current.environmentId) === String(project.environmentId) &&
    first(current.projectId) === String(project.id)
  ) {
    return current;
  }
  return {
    requestId: makeRequestId(),
    environmentId: String(project.environmentId),
    projectId: String(project.id),
  };
}
