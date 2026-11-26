import { useAtomValue } from "@effect/atom-react";
import {
  sourceControlClients,
  type ChangeRequestTerminology,
} from "@t3tools/client-runtime/source-control-clients";
import { selectEnvironmentQueryData } from "@t3tools/client-runtime/state/runtime";
import type {
  EnvironmentId,
  ProjectId,
  PullRequestDetail,
  PullRequestRef,
  ThreadPullRequestLink,
} from "@t3tools/contracts";
import type { AsyncResult } from "effect/reactivity";

import { pullRequestEnvironment } from "~/state/pullRequests";
import { useEnvironmentQuerySelector } from "~/state/query";

export interface ThreadAutoMerge {
  readonly reference: PullRequestRef;
  readonly url: string;
  readonly terminology: ChangeRequestTerminology;
  /** The host offers turning it off, this viewer may, and the environment allows writes. */
  readonly canDisable: boolean;
}

const selectArmed = <E>(result: AsyncResult.AsyncResult<PullRequestDetail, E>) => {
  if (result._tag === "Initial") return "unknown" as const;
  const detail = selectEnvironmentQueryData(result);
  if (detail?.state !== "open" || detail.autoMergeEnabled !== true) return null;
  return {
    provider: detail.provider,
    hostAllowsDisable:
      detail.capabilities.actions.includes("disable-auto-merge") &&
      detail.viewerPermissions.actions.includes("disable-auto-merge"),
  };
};

/** Auto-merge on `link`, the thread's current PR: null when it is off or the PR isn't open,
 * "unknown" until its detail answers. Link snapshots don't carry auto-merge, so this reads the
 * detail the PR panel reads (same query, so the panel and the details card share the request). */
export function useThreadAutoMerge(
  environmentId: EnvironmentId,
  projectId: ProjectId | null | undefined,
  link: ThreadPullRequestLink | null,
): ThreadAutoMerge | "unknown" | null {
  const open = projectId != null && link?.snapshot?.state === "open" ? link : null;
  const reference =
    open === null || projectId == null
      ? null
      : { projectId, host: open.host, repository: open.repository, number: open.number };
  const armed = useEnvironmentQuerySelector(
    reference === null
      ? null
      : pullRequestEnvironment.detail({
          environmentId,
          input: { ...reference, allowStale: false },
        }),
    selectArmed,
  );
  const canWrite = useAtomValue(pullRequestEnvironment.runAction.permissionAtom(environmentId));
  if (open === null || reference === null || armed === null) return null;
  if (armed === "unknown") return "unknown";
  return {
    reference,
    url: open.url,
    terminology: sourceControlClients.get(armed.provider).changeRequest,
    canDisable: armed.hostAllowsDisable && canWrite,
  };
}
