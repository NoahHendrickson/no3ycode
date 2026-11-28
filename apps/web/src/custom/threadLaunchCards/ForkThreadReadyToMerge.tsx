/**
 * A launched thread's PR, ready to merge, acted on from the conversation that started it — see
 * `.fork/customizations.yaml#fork-thread-launch-cards`. One slim line under the thread's row, made
 * of the composer's own controls: its PR chip, a merge chip, and a quiet Go to thread.
 */
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import {
  sourceControlClients,
  UNKNOWN_SOURCE_CONTROL_CLIENT,
} from "@t3tools/client-runtime/source-control-clients";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { ThreadPullRequestLink } from "@t3tools/contracts";
import { useAtomValue } from "@effect/atom-react";

import { ComposerControl } from "~/components/chat/ComposerControl";
import { resolvePullRequestMergeMethod } from "~/components/pullRequest/pullRequestDetail.logic";
import {
  usePullRequestActionRunner,
  usePullRequestDefaultMergeMethodResolver,
} from "~/components/pullRequest/usePullRequestActions";
import { useThreadDisplayedPullRequest } from "~/components/ThreadStatusIndicators";
import { useOpenPrLink } from "~/lib/openPullRequestLink";
import { readLocalApi } from "~/localApi";
import { pullRequestEnvironment } from "~/state/pullRequests";
import { useUiStateStore } from "~/uiStateStore";

import { ThreadPullRequestChip } from "../ComposerPullRequestChip";
import { GitMergeIcon } from "../icons/lucide-hugeicons";
import { useThreadAutoMerge } from "../threadAutoMerge";
import { THREAD_PULL_REQUEST_STAGE_LABELS } from "./threadLaunch.logic";

/** `link`, the thread's current PR, already read ready (threadRowLiveState). The owner's click on
    Merge, once confirmed, is the approval: it merges on the host as the PR list's Merge does, and
    like it leaves a stacked PR to its PR page. */
export function ForkThreadReadyToMerge(props: {
  readonly thread: EnvironmentThreadShell;
  readonly link: ThreadPullRequestLink;
  readonly onOpenThread: () => void;
}) {
  const { thread, link } = props;
  const { environmentId } = thread;
  // Scoped to this PR alone: with the thread's other PRs the badge would read as a stack or "+N".
  const onlyLink = [link];
  const pr = useThreadDisplayedPullRequest(environmentId, {
    pullRequests: onlyLink,
    linkedPullRequest: null,
    branchPullRequest: null,
  });
  const openPrLink = useOpenPrLink(scopeThreadRef(environmentId, thread.id));
  const canWrite = useAtomValue(pullRequestEnvironment.runAction.permissionAtom(environmentId));
  const resolveProjectDefault = usePullRequestDefaultMergeMethodResolver(
    environmentId,
    thread.projectId,
  );
  // Merge holds while the host is set to merge it on its own, as the composer's pill does.
  const autoMerge = useThreadAutoMerge(environmentId, thread.projectId, link);
  const host =
    sourceControlClients.findByChangeRequestUrl(link.url) ?? UNKNOWN_SOURCE_CONTROL_CLIENT;
  const { actionPending, perform } = usePullRequestActionRunner({
    environmentId,
    reference: {
      projectId: thread.projectId,
      host: link.host,
      repository: link.repository,
      number: link.number,
    },
    terminology: host.changeRequest,
    resolveMergeMethod: (detail) => {
      const allowed = detail.capabilities.mergeMethods.filter(
        (method) => detail.mergeCapabilities[method],
      );
      if (allowed.length === 0)
        throw new Error("No merge method is available for this repository.");
      return resolvePullRequestMergeMethod(
        allowed,
        null,
        resolveProjectDefault(),
        useUiStateStore.getState().pullRequestMergeMethod,
      );
    },
  });
  const offersMerge =
    autoMerge === null && link.stack === null && host.changeRequestActions.has("merge");
  const merge = async () => {
    const confirmed = await readLocalApi()?.dialogs.confirm(
      [`Merge pull request #${link.number}?`, link.snapshot?.title].filter(Boolean).join("\n"),
      { initialFocus: "confirm" },
    );
    if (confirmed === true) void perform("merge");
  };
  return (
    <div
      className="flex min-w-0 max-w-full flex-wrap items-center gap-1 ps-4"
      data-fork-thread-ready-to-merge=""
    >
      <ThreadPullRequestChip
        pr={{ ...pr, currentLink: link, number: link.number, url: link.url }}
        pullRequests={onlyLink}
        onOpenList={props.onOpenThread}
        onOpenPullRequest={(event, targetUrl) => openPrLink(event, targetUrl ?? link.url)}
      />
      <span className="shrink-0 px-1 text-xs text-muted-foreground">
        {THREAD_PULL_REQUEST_STAGE_LABELS.ready}
      </span>
      {offersMerge ? (
        <ComposerControl
          size="xs"
          data-fork-composer-status-chip="merge"
          disabled={!canWrite || actionPending}
          onClick={() => void merge()}
        >
          <GitMergeIcon aria-hidden />
          {/* oxlint-disable-next-line t3code/no-untranslated-copy -- fork copy stays English (fork-i18n-catalog) */}
          Merge PR
        </ComposerControl>
      ) : null}
      <ComposerControl size="xs" onClick={props.onOpenThread}>
        {/* oxlint-disable-next-line t3code/no-untranslated-copy -- fork copy stays English (fork-i18n-catalog) */}
        Go to thread
      </ComposerControl>
    </div>
  );
}
