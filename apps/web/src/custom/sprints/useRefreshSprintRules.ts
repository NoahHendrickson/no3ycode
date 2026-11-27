/** Runs refreshSprintRules once a session for each listed sprint — see
    `#fork-sprint-rules-refresh`. */
import type { EnvironmentId } from "@t3tools/contracts";

import { quietFolderFiles } from "../hostFolderFiles";
import { useRefreshFolderRules } from "../useRefreshFolderRules";
import { refreshSprintRules } from "./refreshSprintRules";

interface RefreshableSprint {
  readonly environmentId: EnvironmentId;
  readonly id: string;
  readonly title: string;
  readonly projectId: string;
  readonly worktreePath: string | null;
}

/** `projectByKey` is keyed `environmentId:projectId`; a sprint whose project has not loaded yet
    waits for a later render. */
export function useRefreshSprintRules(
  sprints: ReadonlyArray<RefreshableSprint>,
  projectByKey: ReadonlyMap<string, { readonly title: string; readonly workspaceRoot: string }>,
): void {
  useRefreshFolderRules(sprints, (sprint, registry) => {
    const project = projectByKey.get(`${sprint.environmentId}:${sprint.projectId}`);
    if (sprint.worktreePath === null || project === undefined) return null;
    return refreshSprintRules(
      quietFolderFiles(registry, { environmentId: sprint.environmentId, cwd: sprint.worktreePath }),
      {
        name: sprint.title,
        threadId: sprint.id,
        projectId: sprint.projectId,
        projectTitle: project.title,
        projectRoot: project.workspaceRoot,
        folderPath: sprint.worktreePath,
      },
    );
  });
}
