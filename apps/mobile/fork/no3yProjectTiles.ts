/**
 * New agent's project tiles on no3y iOS: which projects show and what each says — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`. Ranked as the Mac launchpad ranks
 * (fork-draft-project-quick-picks): by the threads the roster would show, newest first.
 */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { getThreadSortTimestamp } from "@t3tools/client-runtime/state/thread-sort";

import type { HomeProjectScope } from "../src/features/home/homeThreadList";
import { filterProjectScopes } from "../src/features/threads/new-task-project-selection";
import { relativeTime } from "../src/lib/time";
import { filterForkRosterVisibleThreads } from "./forkRosterVisibility";
import { sidebarV2StatusBucketForKind } from "./forkStatusGrouping";
import { resolveNo3yThreadCardStatusKind } from "./mobileStatusGrouping";
import { isNo3yChatThread } from "./no3yChatRule";

export interface No3yProjectTile {
  readonly scope: HomeProjectScope;
  /** Roster threads in the project that are working now. */
  readonly working: number;
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
  readonly now: string;
  readonly searchQuery: string;
  readonly selectedScopeKey: string | null;
  readonly limit: number;
}): ReadonlyArray<No3yProjectTile> {
  const stats = new Map<string, { working: number; lastActivityMs: number }>();
  for (const thread of filterForkRosterVisibleThreads(input.threads)) {
    if (isNo3yChatThread(thread, input.sentChatKeys)) continue;
    const key = `${thread.environmentId}:${thread.projectId}`;
    const entry = stats.get(key) ?? { working: 0, lastActivityMs: 0 };
    const bucket = sidebarV2StatusBucketForKind(
      resolveNo3yThreadCardStatusKind(thread, { now: input.now }),
    );
    stats.set(key, {
      working: entry.working + (bucket === "working" ? 1 : 0),
      lastActivityMs: Math.max(entry.lastActivityMs, getThreadSortTimestamp(thread, "updated_at")),
    });
  }
  const tiles = filterProjectScopes(input.scopes, input.searchQuery).map((scope) => {
    let working = 0;
    let lastActivityMs = 0;
    for (const ref of scope.projectRefs) {
      const entry = stats.get(`${ref.environmentId}:${ref.projectId}`);
      if (!entry) continue;
      working += entry.working;
      lastActivityMs = Math.max(lastActivityMs, entry.lastActivityMs);
    }
    return { scope, working, lastActivityMs };
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

/** A tile's muted line: how many threads work there now, else how long since its last activity. */
export function no3yProjectTileStatus(tile: No3yProjectTile, nowMs: number): string {
  if (tile.working > 0) return `${tile.working} working`;
  if (tile.lastActivityMs === 0) return "No threads";
  const age = relativeTime(new Date(tile.lastActivityMs).toISOString(), nowMs);
  return age === "<1m" ? "Just now" : `${age} ago`;
}
