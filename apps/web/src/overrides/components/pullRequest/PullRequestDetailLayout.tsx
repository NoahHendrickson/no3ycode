// Fork shadow of upstream PullRequestDetailLayout — see
// `.fork/customizations.yaml#pr-header-hierarchy`. Everything else passes through untouched.
import { useGT } from "gt-react";
import { ArrowRightIcon, GitBranchIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

import { PullRequestMetaLine } from "./pullRequestPresentation";

export * from "~upstream/components/pullRequest/PullRequestDetailLayout";

/** Head into base, left to right; the full header and the condensed row both render it. */
export function PullRequestBranchFlow({
  head,
  base,
  density,
}: {
  head: ReactNode;
  base: ReactNode;
  density: "default" | "compact";
}) {
  const gt = useGT();
  const compact = density === "compact";
  return (
    <span
      className={cn(
        "flex min-w-0 flex-auto items-center gap-1.5 font-mono text-muted-foreground",
        compact ? "text-2xs" : "text-xs",
      )}
    >
      {compact ? null : <GitBranchIcon aria-hidden className="size-3.5 shrink-0 opacity-70" />}
      <span className="flex min-w-12 shrink text-foreground/85">{head}</span>
      <ArrowRightIcon
        aria-label={gt("merges into", {
          $context:
            "screen reader label for an arrow between the head branch, read before it, and the base branch it merges into, read after it",
        })}
        className={cn("shrink-0 opacity-50", compact ? "size-3" : "size-3.5")}
      />
      {base}
    </span>
  );
}

export function PullRequestDetailHeaderBody({
  title,
  author,
  updated,
  checkout,
  base,
  head,
  files,
  diffStat,
}: {
  title: ReactNode;
  author: ReactNode;
  updated: ReactNode;
  checkout?: ReactNode;
  base: ReactNode;
  head: ReactNode;
  files: ReactNode;
  diffStat: ReactNode;
}) {
  return (
    <div className="col-span-2 mt-1 min-w-0 px-4 pb-3.5">
      {title}
      <div className="mt-1.5 flex min-h-5 min-w-0 items-center text-xs text-muted-foreground">
        <PullRequestMetaLine className="min-w-0 whitespace-nowrap">
          {author}
          <span className="min-w-0 truncate">{updated}</span>
          <span className="inline-flex shrink-0 items-baseline gap-1.5 tabular-nums">
            <span>{files}</span>
            {diffStat}
          </span>
        </PullRequestMetaLine>
      </div>
      <div className="mt-2.5 flex min-h-5 min-w-0 items-center gap-3 text-xs">
        <PullRequestBranchFlow head={head} base={base} density="default" />
        {checkout ? (
          <span className="flex min-w-0 max-w-[40%] shrink-[12] justify-end text-muted-foreground/70 @max-[28rem]/pr-header:hidden">
            {checkout}
          </span>
        ) : null}
      </div>
    </div>
  );
}
