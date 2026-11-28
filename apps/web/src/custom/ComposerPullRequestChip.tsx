import type {
  EnvironmentId,
  PullRequestChecksState,
  ScopedThreadRef,
  ThreadPullRequestLink,
} from "@t3tools/contracts";
import type { ComponentProps, MouseEvent } from "react";

import { ComposerControl } from "~/components/chat/ComposerControl";
import {
  ThreadPullRequestBadgeControl,
  resolveDisplayedThreadPr,
  useThreadDisplayedPullRequest,
} from "~/components/ThreadStatusIndicators";
import { pullRequestChecksStatePresentation } from "~/components/pullRequest/pullRequestPresentation";
import { usePullRequestActionRunner } from "~/components/pullRequest/usePullRequestActions";
import { useOpenPrLink } from "~/lib/openPullRequestLink";
import { useQuietThreadShell } from "~/state/entities";
import { useEnvironmentQuery } from "~/state/query";
import { useRightPanelStore } from "~/rightPanelStore";
import { vcsEnvironment } from "~/state/vcs";

import { BanIcon, GitMergeIcon } from "./icons/lucide-hugeicons";
import { PullRequestChecksDot } from "./SidebarV2StatusIndicator";
import {
  resolvePullRequestChipChecks,
  resolvePullRequestChipState,
} from "./composerPullRequestChip.logic";
import { type ThreadAutoMerge, useThreadAutoMerge } from "./threadAutoMerge";

/** The thread's PR as a chip above the composer (fork-composer-shell), resolved the way
 * BranchToolbarBranchSelector resolved it in the context row. Renders nothing without a PR. An
 * "Auto-merge" chip follows while the host is set to merge the PR on its own. */
export function ComposerPullRequestChip(props: {
  readonly threadRef: ScopedThreadRef;
  readonly branch: string | null;
  /** ChatView's git-status cwd, so this reads its subscription. */
  readonly cwd: string | null;
  /** False in an embedded thread, whose list would open in its host's panel with the host's PRs. */
  readonly canOpenList: boolean;
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
  const autoMerge = useThreadAutoMerge(threadRef.environmentId, thread?.projectId, pr.currentLink);
  return (
    <>
      <ThreadPullRequestChip
        pr={pr}
        pullRequests={thread?.pullRequests ?? []}
        onOpenList={
          props.canOpenList
            ? () => useRightPanelStore.getState().open(threadRef, "pull-requests")
            : null
        }
        onOpenPullRequest={(event, targetUrl) => {
          const url = targetUrl ?? prUrl;
          if (url) openPrLink(event, url);
        }}
      />
      {autoMerge !== null && autoMerge !== "unknown" ? (
        <ComposerAutoMergeChip
          environmentId={threadRef.environmentId}
          autoMerge={autoMerge}
          onOpen={openPrLink}
        />
      ) : null}
    </>
  );
}

/** The thread's PR as the composer's chip: the shared badge, filled by the PR's state, with an
 * open PR's CI pill. A conversation's thread row draws it too (fork-thread-launch-cards). */
export function ThreadPullRequestChip(props: {
  readonly pr: ReturnType<typeof useThreadDisplayedPullRequest>;
  readonly pullRequests: ReadonlyArray<ThreadPullRequestLink>;
  /** Null where the list has nowhere to open (an embedded thread). */
  readonly onOpenList: (() => void) | null;
  readonly onOpenPullRequest: (event: MouseEvent<HTMLElement>, url?: string) => void;
}) {
  const { pr } = props;
  return (
    <ThreadPullRequestBadgeControl
      render={
        <PullRequestChipControl
          checks={resolvePullRequestChipChecks({
            badge: pr.badge,
            snapshot: pr.currentLink?.snapshot,
          })}
          size="xs"
          data-fork-composer-status-chip="pull-request"
          data-fork-pr-chip
          data-pr-state={resolvePullRequestChipState({
            badge: pr.badge,
            pr: pr.pr,
            pullRequests: props.pullRequests,
          })}
        />
      }
      badge={pr.badge}
      pullRequests={props.pullRequests}
      number={pr.number}
      url={pr.url}
      status={pr.status}
      onOpenList={props.onOpenList}
      onOpenPullRequest={props.onOpenPullRequest}
    />
  );
}

/** The PR chip's control: the shared badge's glyph and number, then an open PR's CI as a small
 * pill inside the chip, a dot and "CI". The badge's aria-label names the control and hides its
 * content, so the checks' state joins that label. */
export function PullRequestChipControl({
  checks,
  variant = "composer",
  children,
  ...props
}: ComponentProps<typeof ComposerControl> & {
  readonly checks: PullRequestChecksState | null;
  /** `row`: the smaller, deeper chip a bot panel's thread row wears (ComposerShell.css). */
  readonly variant?: "composer" | "row";
}) {
  return (
    <ComposerControl
      {...props}
      data-fork-pr-chip-variant={variant === "row" ? "row" : undefined}
      aria-label={
        checks === null
          ? props["aria-label"]
          : [props["aria-label"], pullRequestChecksStatePresentation(checks).label]
              .filter(Boolean)
              .join(", ")
      }
    >
      {children}
      {checks === null ? null : (
        <span data-fork-pr-chip-ci={checks}>
          <PullRequestChecksDot state={checks} />
          CI
        </span>
      )}
    </ComposerControl>
  );
}

/** Auto-merge armed on the thread's PR: the label opens the PR, the ban button turns auto-merge off. */
function ComposerAutoMergeChip(props: {
  readonly environmentId: EnvironmentId;
  readonly autoMerge: ThreadAutoMerge;
  readonly onOpen: (event: MouseEvent<HTMLElement>, url: string) => void;
}) {
  const { reference, url, terminology, canDisable } = props.autoMerge;
  const { actionPending, perform } = usePullRequestActionRunner({
    environmentId: props.environmentId,
    reference,
    terminology,
  });
  return (
    <span data-fork-composer-status-chip="auto-merge" className="inline-flex min-w-0 items-center">
      <ComposerControl
        size="xs"
        data-fork-status-chip-main=""
        {...(canDisable ? {} : { "data-fork-status-chip-solo": "" })}
        // oxlint-disable-next-line t3code/no-untranslated-copy -- fork copy stays English (fork-i18n-catalog)
        title="Auto-merge is on: the host merges it once it's ready"
        onClick={(event) => props.onOpen(event, url)}
        // Middle-click opens it in the browser, as on the PR chip; right-click is the menu's.
        onAuxClick={(event) => {
          if (event.button === 1) props.onOpen(event, url);
        }}
      >
        <GitMergeIcon aria-hidden />
        {/* oxlint-disable-next-line t3code/no-untranslated-copy -- fork copy stays English (fork-i18n-catalog) */}
        Auto-merge
      </ComposerControl>
      {canDisable ? (
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
