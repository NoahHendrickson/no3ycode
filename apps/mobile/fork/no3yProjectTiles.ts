/**
 * New agent's project rows on no3y iOS: which projects show, in what order — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`. Ranked as the Mac launchpad ranks
 * (fork-draft-project-quick-picks): by the threads the roster would show, newest first.
 */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { getThreadSortTimestamp } from "@t3tools/client-runtime/state/thread-sort";

import type { HomeProjectScope } from "../src/features/home/homeThreadList";
import { filterProjectScopes } from "../src/features/threads/new-task-project-selection";
import { filterForkRosterVisibleThreads } from "./forkRosterVisibility";
import { isNo3yChatThread } from "./no3yChatRule";

export interface No3yProjectTile {
  readonly scope: HomeProjectScope;
  /** The newest roster thread's activity, in ms, or 0 with none. */
  readonly lastActivityMs: number;
}

/**
 * Up to `limit` projects with a thread the roster shows, newest activity first, else the first
 * pickable ones. A search lists every match, those with threads first. The selected project
 * always keeps a tile, taking the last place when it would not rank in.
 */
export function rankNo3yProjectTiles(input: {
  readonly scopes: ReadonlyArray<HomeProjectScope>;
  readonly threads: ReadonlyArray<EnvironmentThreadShell>;
  readonly sentChatKeys: ReadonlySet<string>;
  readonly searchQuery: string;
  readonly selectedScopeKey: string | null;
  readonly limit: number;
}): ReadonlyArray<No3yProjectTile> {
  const lastActivity = new Map<string, number>();
  for (const thread of filterForkRosterVisibleThreads(input.threads)) {
    if (isNo3yChatThread(thread, input.sentChatKeys)) continue;
    const key = `${thread.environmentId}:${thread.projectId}`;
    lastActivity.set(
      key,
      Math.max(lastActivity.get(key) ?? 0, getThreadSortTimestamp(thread, "updated_at")),
    );
  }
  const tiles = filterProjectScopes(input.scopes, input.searchQuery).map((scope) => {
    let lastActivityMs = 0;
    for (const ref of scope.projectRefs) {
      lastActivityMs = Math.max(
        lastActivityMs,
        lastActivity.get(`${ref.environmentId}:${ref.projectId}`) ?? 0,
      );
    }
    return { scope, lastActivityMs };
  });
  const live = tiles
    .filter((tile) => tile.lastActivityMs > 0)
    .sort((left, right) => right.lastActivityMs - left.lastActivityMs);
  const rest = tiles.filter((tile) => tile.lastActivityMs === 0);
  if (input.searchQuery.trim().length > 0) return [...live, ...rest];

  const shown = (live.length > 0 ? live : rest).slice(0, input.limit);
  const selected = tiles.find((tile) => tile.scope.key === input.selectedScopeKey);
  if (selected === undefined || shown.includes(selected)) return shown;
  return [...shown.slice(0, Math.max(0, input.limit - 1)), selected];
}
