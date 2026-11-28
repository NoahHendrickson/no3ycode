/**
 * A launched thread's PR, ready to merge, acted on from the conversation that started it — see
 * `.fork/customizations.yaml#fork-thread-launch-cards`. One slim line under the thread's row, made
 * of the composer's own controls: its PR chip, the Merge PR pill's look, and a quiet Go to thread.
 */
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import {
  sourceControlClients,
  UNKNOWN_SOURCE_CONTROL_CLIENT,
} from "@t3tools/client-runtime/source-control-clients";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { useAtomValue } from "@effect/atom-react";

import { ComposerControl } from "~/components/chat/ComposerControl";
import { resolvePullRequestMergeMethod } from "~/components/pullRequest/pullRequestDetail.logic";
import {
  usePullRequestActionRunner,
  usePullRequestDefaultMergeMethodResolver,
} from "~/components/pullRequest/usePullRequestActions";
import {
  ThreadPullRequestBadgeControl,
  useThreadDisplayedPullRequest,
} from "~/components/ThreadStatusIndicators";
import { useOpenPrLink } from "~/lib/openPullRequestLink";
import { readLocalApi } from "~/localApi";
import { pullRequestEnvironment } from "~/state/pullRequests";
import { useUiStateStore } from "~/uiStateStore";

import { PullRequestChipControl } from "../ComposerPullRequestChip";
import {
  resolvePullRequestChipChecks,
  resolvePullRequestChipState,
} from "../composerPullRequestChip.logic";
import { GitMergeIcon } from "../icons/lucide-hugeicons";
import { useThreadAutoMerge } from "../threadAutoMerge";
import { THREAD_PULL_REQUEST_STAGE_LABELS, threadPullRequestStage } from "./threadLaunch.logic";

/** The thread's current PR when it reads ready to merge; nothing otherwise. The owner's click on
    Merge, once confirmed, is the approval: it merges on the host as the PR list's Merge does. */
export function ForkThreadReadyToMerge(props: {
  readonly thread: EnvironmentThreadShell;
  readonly onOpenThread: () => void;
}) {
  const { thread } = props;
  const { environmentId } = thread;
  const threadRef = scopeThreadRef(environmentId, thread.id);
  const pr = useThreadDisplayedPullRequest(environmentId, thread);
  const link = pr.currentLink;
  const openPrLink = useOpenPrLink(threadRef);
  const canWrite = useAtomValue(pullRequestEnvironment.runAction.permissionAtom(environmentId));
  const resolveProjectDefault = usePullRequestDefaultMergeMethodResolver(
    environmentId,
    thread.projectId,
  );
  // Merge holds while the host is set to merge it on its own, as the composer's pill does.
  const autoMerge = useThreadAutoMerge(environmentId, thread.projectId, link);
  const { actionPending, perform } = usePullRequestActionRunner({
    environmentId,
    reference:
      link === null
        ? null
        : {
            projectId: thread.projectId,
            host: link.host,
            repository: link.repository,
            number: link.number,
          },
    terminology: (
      (link === null ? undefined : sourceControlClients.findByChangeRequestUrl(link.url)) ??
      UNKNOWN_SOURCE_CONTROL_CLIENT
    ).changeRequest,
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
  if (link === null || threadPullRequestStage(link.snapshot) !== "ready") return null;
  const title = link.snapshot?.title;
  const merge = async () => {
    const confirmed = await readLocalApi()?.dialogs.confirm(
      [`Merge pull request #${link.number}?`, title].filter(Boolean).join("\n"),
      { initialFocus: "confirm" },
    );
    if (confirmed === true) void perform("merge");
  };
  return (
    <div
      className="flex min-w-0 max-w-full flex-wrap items-center gap-1 ps-4"
      data-fork-thread-ready-to-merge=""
    >
      <ThreadPullRequestBadgeControl
        render={
          <PullRequestChipControl
            checks={resolvePullRequestChipChecks({ badge: pr.badge, snapshot: link.snapshot })}
            size="xs"
            data-fork-composer-status-chip="pull-request"
            data-fork-pr-chip
            data-pr-state={resolvePullRequestChipState({
              badge: pr.badge,
              pr: pr.pr,
              pullRequests: thread.pullRequests,
            })}
          />
        }
        badge={pr.badge}
        pullRequests={thread.pullRequests}
        number={pr.number}
        url={pr.url}
        status={pr.status}
        onOpenList={props.onOpenThread}
        onOpenPullRequest={(event, targetUrl) => openPrLink(event, targetUrl ?? link.url)}
      />
      <span className="shrink-0 px-1 text-xs text-muted-foreground">
        {THREAD_PULL_REQUEST_STAGE_LABELS.ready}
      </span>
      {autoMerge === null ? (
        <ComposerControl
          size="xs"
          data-fork-composer-status-chip="next-step"
          data-fork-next-step="merge"
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
