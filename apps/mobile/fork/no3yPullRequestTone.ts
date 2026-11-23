/**
 * A pull request mark's tone on no3y iOS, as the Mac colours and draws it
 * (PULL_REQUEST_STATE_PRESENTATION): open, merged, closed or draft — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`.
 */
import {
  resolveThreadCurrentPullRequestLink,
  resolveThreadPullRequestBadge,
} from "@t3tools/client-runtime/thread-pull-requests";
import type { PullRequestChecksState, ThreadPullRequestLink } from "@t3tools/contracts";

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
  const checks =
    !several && pr.state === "open"
      ? (resolveThreadCurrentPullRequestLink(links)?.snapshot?.checksState ?? null)
      : null;
  return { tone: no3yPullRequestTone(pr), several, more, checks };
}
