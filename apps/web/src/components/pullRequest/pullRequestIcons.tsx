import {
  GitMergeIcon,
  GitPullRequestArrowIcon,
  GitPullRequestClosedIcon,
  GitPullRequestDraftIcon,
  LayersIcon,
  Link2Icon,
  Unlink2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import type { PullRequestState } from "@t3tools/contracts";

export const PullRequestGlyph = {
  pullRequest: GitPullRequestArrowIcon,
  reopen: GitPullRequestArrowIcon,
  draft: GitPullRequestDraftIcon,
  closed: GitPullRequestClosedIcon,
  merged: GitMergeIcon,
  conflicting: TriangleAlertIcon,
  stack: LayersIcon,
  link: Link2Icon,
  unlink: Unlink2Icon,
} as const;

export type PullRequestGlyphIcon = (typeof PullRequestGlyph)[keyof typeof PullRequestGlyph];

export interface PullRequestStatePresentation {
  readonly label: string;
  readonly toneClassName: string;
  readonly Icon: PullRequestGlyphIcon;
}

export const PULL_REQUEST_STATE_PRESENTATION = {
  open: {
    label: "Open",
    /* fork:begin fork-inlet-theme — see .fork/customizations.yaml#fork-inlet-theme
       fork-pr-tone is the hook Inlet Black's charcoal surfaces remap PR tones on
       (theme.custom.inlet-black.css). */
    toneClassName: "text-emerald-600 dark:text-emerald-300/90 fork-pr-tone",
    /* fork:end fork-inlet-theme */
    Icon: PullRequestGlyph.pullRequest,
  },
  draft: {
    label: "Draft",
    toneClassName: "text-zinc-500 dark:text-zinc-400/80",
    Icon: PullRequestGlyph.draft,
  },
  closed: {
    label: "Closed",
    /* fork:begin fork-inlet-theme — see .fork/customizations.yaml#fork-inlet-theme */
    toneClassName: "text-red-600 dark:text-red-300/90 fork-pr-tone",
    /* fork:end fork-inlet-theme */
    Icon: PullRequestGlyph.closed,
  },
  merged: {
    label: "Merged",
    /* fork:begin fork-inlet-theme — see .fork/customizations.yaml#fork-inlet-theme */
    toneClassName: "text-violet-600 dark:text-violet-300/90 fork-pr-tone",
    /* fork:end fork-inlet-theme */
    Icon: PullRequestGlyph.merged,
  },
} as const satisfies Record<PullRequestState | "draft", PullRequestStatePresentation>;
