/**
 * A sprint's Pull requests tab — see `.fork/customizations.yaml#fork-sprints`. One row per pull
 * request its threads opened: title, then number, stage and thread. A row opens the PR.
 */
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";

import { useOpenPrLink } from "~/lib/openPullRequestLink";
import { useQuietThreadShells } from "~/state/entities";

import { GitMergeIcon, GitPullRequestIcon } from "../icons/lucide-hugeicons";
import { THREAD_PULL_REQUEST_STAGE_LABELS } from "../threadLaunchCards/threadLaunch.logic";
import { sprintPullRequests } from "./sprintPullRequests.logic";

export function SprintPullRequests(props: { readonly sprintRef: ScopedThreadRef }) {
  const threads = useQuietThreadShells();
  const openPrLink = useOpenPrLink(props.sprintRef);
  const rows = sprintPullRequests(threads, props.sprintRef);
  if (rows.length === 0) {
    return (
      <p className="px-3.5 py-3 text-sm text-muted-foreground">
        The sprint's threads have not opened any pull requests.
      </p>
    );
  }
  return (
    <ul className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5" data-fork-sprint-pull-requests="">
      {rows.map((row) => {
        const Icon = row.stage === "merged" ? GitMergeIcon : GitPullRequestIcon;
        const threadRef = scopeThreadRef(row.thread.environmentId, row.thread.id);
        const meta = [
          `#${row.number}`,
          row.stage === null ? null : THREAD_PULL_REQUEST_STAGE_LABELS[row.stage],
          row.thread.title,
        ].filter((part) => part !== null);
        return (
          <li key={row.url}>
            <button
              type="button"
              className="flex w-full min-w-0 items-start gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-accent"
              onClick={(event) => openPrLink(event, row.url, threadRef)}
              onAuxClick={(event) => openPrLink(event, row.url, threadRef)}
            >
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm text-foreground">
                  {row.title ?? `Pull request #${row.number}`}
                </span>
                <span className="truncate text-xs text-muted-foreground">{meta.join(" · ")}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
