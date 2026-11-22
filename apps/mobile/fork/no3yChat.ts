/**
 * The Chat screen's draft rules: the route that hosts the chat draft and the No-project
 * workspace a new chat starts in — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 * Kept free of heavy imports: the new-task flow store reads the route predicate.
 */
import { isScratchProject } from "@t3tools/client-runtime/state/projects";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import type { EnvironmentId } from "@t3tools/contracts";

import type { NewTaskDraftRouteParams } from "../src/features/threads/thread-route-state";

/**
 * The Chat route once it carries its draft. The new-task flow serves it like a draft thread, so
 * its composer, model sheet, effort and access are New agent's.
 */
export function isNo3yChatDraftRoute(
  route: { readonly name: string; readonly params?: object } | undefined,
): boolean {
  return (
    route?.name === "No3yChat" && Boolean((route.params as { draft?: unknown } | undefined)?.draft)
  );
}

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
 * The draft the Chat route should carry: its own while it still names the chat's project, a
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
