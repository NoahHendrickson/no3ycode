/**
 * A pull request mark's tone on no3y iOS, as the Mac colours and draws it
 * (PULL_REQUEST_STATE_PRESENTATION): open, merged, closed or draft — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`.
 */
import {
  resolveThreadCurrentPullRequestLink,
  resolveThreadPullRequestBadge,
} from "@t3tools/client-runtime/thread-pull-requests";
import type {
  PullRequestChecks,
  PullRequestChecksState,
  ThreadPullRequestLink,
} from "@t3tools/contracts";

import {
  resolveThreadPrBadgeAction,
  type ThreadPrPresentation,
} from "../src/state/thread-pr-presentation";
import type { FlatGlassPalette } from "./flatGlassTheme";

export type No3yPullRequestTone = "open" | "merged" | "closed" | "draft";

/** An unknown state reads as open, as the badge did before its state arrived. */
export function no3yPullRequestTone(pr: {
  readonly state: "open" | "closed" | "merged" | null;
  readonly isDraft: boolean;
}): No3yPullRequestTone {
  if (pr.state === "merged" || pr.state === "closed") return pr.state;
  return pr.isDraft ? "draft" : "open";
}

export function no3yPullRequestColor(tone: No3yPullRequestTone, palette: FlatGlassPalette): string {
  switch (tone) {
    case "open":
      return palette.prOpen;
    case "merged":
      return palette.prMerged;
    case "closed":
      return palette.prClosed;
    case "draft":
      return palette.prDraft;
  }
}

export interface No3yPullRequestPill {
  readonly tone: No3yPullRequestTone;
  /** A stack or several linked: the layers glyph, the current number and how many more. */
  readonly several: boolean;
  readonly more: number;
  /** Checks on a single open linked pull request, for the running or failing mark. */
  readonly checks: PullRequestChecksState | null;
  /** The pull request those checks belong to, so the pill can reread them per check. */
  readonly checksLink: ThreadPullRequestLink | null;
}

/** What the pull request pill above the composer draws (fork/No3yStatusPill.tsx). */
export function no3yPullRequestPill(
  pr: ThreadPrPresentation,
  links: ReadonlyArray<ThreadPullRequestLink>,
): No3yPullRequestPill {
  const several = resolveThreadPrBadgeAction(pr).kind === "list";
  const badge = several ? resolveThreadPullRequestBadge(links) : null;
  const more =
    badge === null ? pr.others : badge.kind === "stack" ? badge.layers - 1 : badge.others;
  const checksLink =
    !several && pr.state === "open" ? resolveThreadCurrentPullRequestLink(links) : null;
  const checks = checksLink?.snapshot?.checksState ?? null;
  return { tone: no3yPullRequestTone(pr), several, more, checks, checksLink };
}

/**
 * The checks mark as the PR watcher reads it (pullRequestWatch.ts): only required checks count
 * when the host names any, so an optional job still running does not hold the pill at pending.
 * A read older than the snapshot's last change keeps the snapshot's whole-rollup state.
 */
export function no3yWatcherChecksState(
  rollup: PullRequestChecksState | null,
  live: PullRequestChecks | null,
  syncedAt: string | undefined,
): PullRequestChecksState | null {
  if (rollup !== "pending" && rollup !== "failing") return rollup;
  // A placeholder stands for checks the host could not list; the watcher waits on it too.
  if (
    live === null ||
    live.checks.length === 0 ||
    live.checks.some((check) => check.placeholder === true)
  ) {
    return rollup;
  }
  if (
    syncedAt !== undefined &&
    live.observedAt !== undefined &&
    live.observedAt < Date.parse(syncedAt)
  ) {
    return rollup;
  }
  const required = live.checks.filter((check) => check.required === true);
  const gate = required.length > 0 ? required : live.checks;
  if (gate.some((check) => check.status === "failure" || check.status === "cancelled")) {
    return "failing";
  }
  // A run awaiting approval holds the watcher whether or not it is required.
  if (
    gate.some((check) => check.status === "pending") ||
    live.checks.some((check) => check.status === "action-required")
  ) {
    return "pending";
  }
  return "passing";
}
