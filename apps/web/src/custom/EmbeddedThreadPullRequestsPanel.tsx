import { visibleThreadPullRequests } from "@t3tools/client-runtime/thread-pull-requests";
import type {
  ProjectId,
  ScopedThreadRef,
  ThreadLinkedPullRequest,
  ThreadPullRequestLink,
} from "@t3tools/contracts";
import { T } from "gt-react";

import { pullRequestPanelContext } from "~/components/pullRequest/pullRequestDetail.logic";
import { ThreadPullRequestsPanel } from "~/components/pullRequest/ThreadPullRequestsPanel";
import { type RightPanelSurface, useRightPanelStore } from "~/rightPanelStore";
import { useQuietThreadShell } from "~/state/entities";
import { useEnvironmentShellStatus } from "~/state/shell";
import { isThreadRouteSnapshotAuthoritative } from "~/threadRoutes";

import { RightPanelOwnerContext } from "./rightPanelOwnerContext";

/** Renders a foreign (embedded) thread's PR list inside a host panel, guarding against unloaded
 * or deleted child threads so an orphaned tab never shows a live "Link pull request" empty state. */
export function EmbeddedThreadPullRequestsPanel(props: {
  readonly threadRef: ScopedThreadRef;
  readonly panelRef: ScopedThreadRef;
}) {
  const { threadRef, panelRef } = props;
  const shell = useQuietThreadShell(threadRef);
  const bootstrapComplete = isThreadRouteSnapshotAuthoritative(
    useEnvironmentShellStatus(threadRef.environmentId),
  );
  if (shell === null && !bootstrapComplete) return null;
  if (shell === null || shell.deletedAt != null) {
    return (
      <p className="p-3 text-xs text-muted-foreground">
        <T>This thread is no longer available.</T>
      </p>
    );
  }
  return (
    <RightPanelOwnerContext value={panelRef}>
      <ThreadPullRequestsPanel threadRef={threadRef} />
    </RightPanelOwnerContext>
  );
}

/** Resolves `PullRequestDetailPanel`'s `context` and `onBack` from a foreign originating thread
 * when a PR tab was opened from an embedded child's PR list, falling back to the host's props. */
export function useEmbeddedPullRequestDetailProps(input: {
  readonly surface: RightPanelSurface | null;
  readonly hostPanelRef: ScopedThreadRef;
  readonly hostPullRequest: {
    readonly projectId: ProjectId | null;
    readonly pullRequests: ReadonlyArray<ThreadPullRequestLink>;
    readonly linkedPullRequest: ThreadLinkedPullRequest | null;
    readonly branchPullRequest: ThreadLinkedPullRequest | null | undefined;
    readonly onBack: (() => void) | undefined;
  };
}): {
  readonly context: "page" | "thread";
  readonly onBack: (() => void) | undefined;
} {
  const { surface, hostPanelRef, hostPullRequest } = input;
  const listThreadRef = surface?.kind === "pull-request" ? (surface.listThreadRef ?? null) : null;
  const originShell = useQuietThreadShell(listThreadRef);
  if (surface?.kind !== "pull-request") {
    return { context: "page", onBack: hostPullRequest.onBack };
  }
  if (listThreadRef === null) {
    return {
      context: pullRequestPanelContext(
        {
          projectId: hostPullRequest.projectId,
          pullRequests: hostPullRequest.pullRequests,
          linkedPullRequest: hostPullRequest.linkedPullRequest,
          branchPullRequest: hostPullRequest.branchPullRequest,
        },
        surface,
      ),
      onBack: hostPullRequest.onBack,
    };
  }
  const originLinks = visibleThreadPullRequests(originShell?.pullRequests ?? []);
  return {
    context: pullRequestPanelContext(
      {
        projectId: originShell?.projectId ?? null,
        pullRequests: originLinks,
        linkedPullRequest: null,
        branchPullRequest: originShell?.branchPullRequest,
      },
      surface,
    ),
    onBack:
      originLinks.length > 1
        ? () => useRightPanelStore.getState().openPullRequests(hostPanelRef, listThreadRef)
        : undefined,
  };
}
