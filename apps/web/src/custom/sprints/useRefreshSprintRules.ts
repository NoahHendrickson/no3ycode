/** Runs refreshSprintRules once a session for each listed sprint — see
    `#fork-sprint-rules-refresh`. */
import { RegistryContext } from "@effect/atom-react";
import type { EnvironmentId } from "@t3tools/contracts";
import { useContext, useEffect } from "react";

import { botFolderFiles } from "../bots/useRefreshBotRules";
import { refreshSprintRules } from "./refreshSprintRules";

interface RefreshableSprint {
  readonly environmentId: EnvironmentId;
  readonly id: string;
  readonly title: string;
  readonly projectId: string;
  readonly worktreePath: string | null;
}

/** Sprints this session refreshed, found current, or is refreshing now. */
const checked = new Set<string>();
/** When a sprint's last attempt failed; retried once a minute at most, as a bot's is. */
const failedAt = new Map<string, number>();
const RETRY_AFTER_MS = 60_000;

/** `projectByKey` is keyed `environmentId:projectId`; a sprint whose project has not loaded yet
    waits for a later render. */
export function useRefreshSprintRules(
  sprints: ReadonlyArray<RefreshableSprint>,
  projectByKey: ReadonlyMap<string, { readonly title: string; readonly workspaceRoot: string }>,
): void {
  const registry = useContext(RegistryContext);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- writes the listed sprints' rule files on their host, once per sprint per session unless it failed
  useEffect(() => {
    for (const sprint of sprints) {
      const key = `${sprint.environmentId}:${sprint.id}`;
      const project = projectByKey.get(`${sprint.environmentId}:${sprint.projectId}`);
      if (sprint.worktreePath === null || project === undefined || checked.has(key)) continue;
      if (Date.now() - (failedAt.get(key) ?? -Infinity) < RETRY_AFTER_MS) continue;
      checked.add(key);
      void refreshSprintRules(botFolderFiles(registry, sprint.environmentId, sprint.worktreePath), {
        name: sprint.title,
        threadId: sprint.id,
        projectId: sprint.projectId,
        projectTitle: project.title,
        projectRoot: project.workspaceRoot,
        folderPath: sprint.worktreePath,
      }).catch(() => {
        checked.delete(key);
        failedAt.set(key, Date.now());
      });
    }
  }, [sprints, projectByKey, registry]);
}
