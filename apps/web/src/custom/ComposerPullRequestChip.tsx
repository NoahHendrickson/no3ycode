import { sourceControlClients } from "@t3tools/client-runtime/source-control-clients";
import type { EnvironmentId, PullRequestRef, ScopedThreadRef } from "@t3tools/contracts";
import { useAtomValue } from "@effect/atom-react";
import type { MouseEvent } from "react";

import { ComposerControl } from "~/components/chat/ComposerControl";
import {
  ThreadPullRequestBadgeControl,
  resolveDisplayedThreadPr,
  useThreadDisplayedPullRequest,
} from "~/components/ThreadStatusIndicators";
import { usePullRequestActionRunner } from "~/components/pullRequest/usePullRequestActions";
import { useOpenPrLink } from "~/lib/openPullRequestLink";
import { pullRequestEnvironment } from "~/state/pullRequests";
import { useQuietThreadShell } from "~/state/entities";
import { useEnvironmentQuery } from "~/state/query";
import { useRightPanelStore } from "~/rightPanelStore";
import { vcsEnvironment } from "~/state/vcs";

import { BanIcon, GitMergeIcon } from "./icons/lucide-hugeicons";
import { resolvePullRequestChipState } from "./composerPullRequestChip.logic";
import { type ThreadAutoMergeState, useThreadAutoMerge } from "./threadAutoMerge";

/** The thread's PR as a chip above the composer (fork-composer-shell), resolved the way
 * BranchToolbarBranchSelector resolved it in the context row. Renders nothing without a PR. An
 * "Auto-merge" chip follows while the host is set to merge the PR on its own. */
export function ComposerPullRequestChip(props: {
  readonly threadRef: ScopedThreadRef;
  readonly branch: string | null;
  /** ChatView's git-status cwd, so this reads its subscription. */
  readonly cwd: string | null;
}) {
  const { threadRef } = props;
  const thread = useQuietThreadShell(threadRef);
  // The full status, not ChatView's trimmed one: it names the host, which words "PR" or "MR".
  const status = useEnvironmentQuery(
    props.cwd === null
      ? null
      : vcsEnvironment.status({
          environmentId: threadRef.environmentId,
          input: { cwd: props.cwd },
        }),
  );
  const branchPr = resolveDisplayedThreadPr({
    threadBranch: props.branch,
    gitStatus: status.data,
  });
  const pr = useThreadDisplayedPullRequest(
    threadRef.environmentId,
    thread,
    branchPr,
    status.data?.sourceControlProvider,
  );
  const openPrLink = useOpenPrLink(threadRef);
  const prUrl = pr.url;
  const state = resolvePullRequestChipState({
    badge: pr.badge,
    pr: pr.pr,
    pullRequests: thread?.pullRequests ?? [],
  });
  const autoMerge = useThreadAutoMerge(
    threadRef.environmentId,
    thread?.projectId,
    thread?.pullRequests ?? [],
  );
  const autoMergeUrl = pr.currentLink?.url;
  return (
    <>
      <ThreadPullRequestBadgeControl
        render={
          <ComposerControl
            size="xs"
            data-fork-composer-status-chip="pull-request"
            data-fork-pr-chip
            data-pr-state={state}
          />
        }
        badge={pr.badge}
        pullRequests={thread?.pullRequests ?? []}
        number={pr.number}
        url={pr.url}
        status={pr.status}
        onOpenList={() => useRightPanelStore.getState().open(threadRef, "pull-requests")}
        onOpenPullRequest={(event, targetUrl) => {
          const url = targetUrl ?? prUrl;
          if (url) openPrLink(event, url);
        }}
      />
      {autoMerge.state !== "off" && autoMerge.reference !== null && autoMergeUrl ? (
        <ComposerAutoMergeChip
          environmentId={threadRef.environmentId}
          reference={autoMerge.reference}
          state={autoMerge.state}
          url={autoMergeUrl}
          onOpen={openPrLink}
        />
      ) : null}
    </>
  );
}

/** Auto-merge armed on the thread's PR: the label opens the PR, the ban button turns auto-merge off. */
function ComposerAutoMergeChip(props: {
  readonly environmentId: EnvironmentId;
  readonly reference: PullRequestRef;
  readonly state: Exclude<ThreadAutoMergeState, "off">;
  readonly url: string;
  readonly onOpen: (event: MouseEvent<HTMLElement>, url: string) => void;
}) {
  const canWrite = useAtomValue(
    pullRequestEnvironment.runAction.permissionAtom(props.environmentId),
  );
  const { actionPending, perform } = usePullRequestActionRunner({
    environmentId: props.environmentId,
    reference: props.reference,
    terminology: (
      sourceControlClients.findByChangeRequestUrl(props.url) ?? sourceControlClients.get(undefined)
    ).changeRequest,
  });
  const stoppable = props.state === "stoppable" && canWrite;
  return (
    <span data-fork-composer-status-chip="auto-merge" className="inline-flex min-w-0 items-center">
      <ComposerControl
        size="xs"
        data-fork-status-chip-main=""
        {...(stoppable ? {} : { "data-fork-status-chip-solo": "" })}
        // oxlint-disable-next-line t3code/no-untranslated-copy -- fork copy stays English (fork-i18n-catalog)
        title="Auto-merge is on: the host merges this PR once it's ready"
        onClick={(event) => props.onOpen(event, props.url)}
        onAuxClick={(event) => props.onOpen(event, props.url)}
      >
        <GitMergeIcon aria-hidden />
        {/* oxlint-disable-next-line t3code/no-untranslated-copy -- fork copy stays English (fork-i18n-catalog) */}
        Auto-merge
      </ComposerControl>
      {stoppable ? (
        <ComposerControl
          size="xs"
          data-fork-status-chip-stop=""
          // oxlint-disable-next-line t3code/no-untranslated-copy -- fork copy stays English (fork-i18n-catalog)
          aria-label="Turn off auto-merge"
          // oxlint-disable-next-line t3code/no-untranslated-copy -- fork copy stays English (fork-i18n-catalog)
          title="Turn off auto-merge"
          disabled={actionPending}
          onClick={() => void perform("disable-auto-merge")}
        >
          <BanIcon aria-hidden />
        </ComposerControl>
      ) : null}
    </span>
  );
}
