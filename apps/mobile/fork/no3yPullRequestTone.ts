/**
 * A pull request mark's tone on no3y iOS, as the Mac colours and draws it
 * (PULL_REQUEST_STATE_PRESENTATION): open, merged, closed or draft — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`.
 */
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
