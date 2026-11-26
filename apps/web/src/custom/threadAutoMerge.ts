import { selectEnvironmentQueryData } from "@t3tools/client-runtime/state/runtime";
import { resolveThreadCurrentPullRequestLink } from "@t3tools/client-runtime/thread-pull-requests";
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

/** "stoppable" when the host and the viewer both allow turning it off. */
export type ThreadAutoMergeState = "off" | "armed" | "stoppable";

const selectAutoMergeState = <E>(
  result: AsyncResult.AsyncResult<PullRequestDetail, E>,
): ThreadAutoMergeState => {
  const detail = selectEnvironmentQueryData(result);
  if (detail?.state !== "open" || detail.autoMergeEnabled !== true) return "off";
  return detail.capabilities.actions.includes("disable-auto-merge") &&
    detail.viewerPermissions.actions.includes("disable-auto-merge")
    ? "stoppable"
    : "armed";
};

/** Auto-merge on the thread's current PR. Link snapshots don't carry it, so this reads the PR's
 * detail, the same query (and request) the PR panel makes. */
export function useThreadAutoMerge(
  environmentId: EnvironmentId,
  projectId: ProjectId | null | undefined,
  links: ReadonlyArray<ThreadPullRequestLink>,
): { readonly state: ThreadAutoMergeState; readonly reference: PullRequestRef | null } {
  const link = resolveThreadCurrentPullRequestLink(links);
  const reference =
    projectId == null || link?.snapshot?.state !== "open"
      ? null
      : { projectId, host: link.host, repository: link.repository, number: link.number };
  const state = useEnvironmentQuerySelector(
    reference === null
      ? null
      : pullRequestEnvironment.detail({
          environmentId,
          input: { ...reference, allowStale: false },
        }),
    selectAutoMergeState,
  );
  return { state, reference };
}
