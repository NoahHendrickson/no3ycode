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
 * Every pickable project (a search: every match): those with a thread the roster shows first,
 * newest activity first, then the rest in their given order (most recently updated first).
 */
export function rankNo3yProjectTiles(input: {
  readonly scopes: ReadonlyArray<HomeProjectScope>;
  readonly threads: ReadonlyArray<EnvironmentThreadShell>;
  readonly sentChatKeys: ReadonlySet<string>;
  readonly searchQuery: string;
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
  return [...live, ...rest];
}

const EXPAND_SCROLL_THRESHOLD_INDEX = 4;
const EXPAND_SCROLL_LEAD_ROWS = 2;

/**
 * Vertical shift (in ScrollView coordinates) that brings row `rowIndex` directly into the
 * collapsed dropdown slot at the top of the viewport, even when the list was scrolled.
 */
export function no3yCollapsedRowTranslateY(input: {
  readonly rowIndex: number;
  readonly scrollY: number;
  readonly headerOffset: number;
  readonly rowPitch: number;
}): number {
  "worklet";
  return input.scrollY - input.headerOffset - input.rowIndex * input.rowPitch;
}

/**
 * Initial scroll offset when reopening the dropdown: 0 when the picked project is already near
 * the top, otherwise scrolled so the picked row fans out near the top of the viewport.
 */
export function no3yExpandScrollOffset(input: {
  readonly selectedIndex: number;
  readonly rowCount: number;
  readonly rowPitch: number;
  readonly rowGap: number;
  readonly topPadding: number;
  readonly headerOffset: number;
  readonly bottomInset: number;
  readonly viewportHeight: number;
}): number {
  if (
    input.selectedIndex <= EXPAND_SCROLL_THRESHOLD_INDEX ||
    input.rowCount === 0 ||
    input.viewportHeight <= 0
  ) {
    return 0;
  }
  const rowsHeight = input.rowCount * input.rowPitch - input.rowGap;
  const contentHeight = input.topPadding + input.headerOffset + rowsHeight + input.bottomInset;
  const maxScroll = Math.max(0, contentHeight - input.viewportHeight);
  return Math.min((input.selectedIndex - EXPAND_SCROLL_LEAD_ROWS) * input.rowPitch, maxScroll);
}

/** Whether a non-selected row is near enough to the viewport to participate in the collapse morph. */
export function no3yRowVisibleForCollapse(input: {
  readonly rowIndex: number;
  readonly scrollY: number;
  readonly headerOffset: number;
  readonly rowPitch: number;
  readonly viewportHeight: number;
}): boolean {
  "worklet";
  if (input.viewportHeight <= 0) return false;
  const screenY = input.headerOffset + input.rowIndex * input.rowPitch - input.scrollY;
  return screenY >= -input.rowPitch && screenY <= input.viewportHeight + input.rowPitch;
}
