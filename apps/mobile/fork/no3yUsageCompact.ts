/**
 * The compact usage sheet's labels and filters — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 * Copied from the Mac's apps/web/src/custom/ComposerUsageLimitsReadout.tsx and usageLimitNotices.ts.
 */
import {
  collectLimitNotices,
  cursorUsageWindowDetails,
  displayLimitWindows,
  limitsNotice,
  remainingPercent,
  type LimitPool,
  type LimitPoolWindow,
  type LimitPresentations,
} from "@t3tools/shared/usageLimits";
import type { ServerProviderUsageWindow } from "@t3tools/contracts";

const FIVE_HOURS_MINS = 300;
const CLAUDE_FABLE_WINDOW_ID = "seven_day_fable";
const SEVEN_DAYS_MINS = 7 * 24 * 60;

/** Full descriptive label, for accessibility. */
export function fullWindowLabel(pool: LimitPool, window: LimitPoolWindow): string {
  const details = pool.driver === "cursor" ? cursorUsageWindowDetails(window.id, pool) : undefined;
  return (details?.label ?? window.label).replaceAll(" · ", " ");
}

/** Reported duration in minutes when every member in the pool agrees on one duration. */
function uniformWindowDurationMins(window: LimitPoolWindow): number | null {
  let shared: number | null = null;
  for (const member of window.members) {
    // Weekly suppression clears member.window.windowDurationMins; recover the account's original duration.
    const mins =
      member.window.windowDurationMins ??
      member.account.limits.windows.find(
        (candidate) => candidate.id === member.window.id && candidate.kind === member.window.kind,
      )?.windowDurationMins;
    if (mins === undefined) return null;
    if (shared === null) shared = mins;
    else if (shared !== mins) return null;
  }
  return shared;
}

/** `5hr` / `7d` only from typed window durations, else the provider's own label. */
export function compactWindowLabel(pool: LimitPool, window: LimitPoolWindow): string {
  if (pool.driver === "cursor") return fullWindowLabel(pool, window);
  const durationMins = uniformWindowDurationMins(window);
  if (
    durationMins === FIVE_HOURS_MINS &&
    (pool.driver !== "antigravity" || window.id === "five_hour")
  ) {
    return "5hr";
  }
  if (
    window.id === "seven_day" ||
    (durationMins === SEVEN_DAYS_MINS &&
      window.kind === "weekly" &&
      pool.driver !== "claudeAgent" &&
      pool.driver !== "antigravity")
  ) {
    return "7d";
  }
  return fullWindowLabel(pool, window);
}

/** The windows a compact row shows: Claude's Fable weekly breakdown is left out by id. */
export function compactTrayWindows(pool: LimitPool): readonly LimitPoolWindow[] {
  const windows = displayLimitWindows(pool);
  if (pool.driver !== "claudeAgent") return windows;
  return windows.filter((window) => window.id !== CLAUDE_FABLE_WINDOW_ID);
}

/** Derived from upstream's helper, so a rewording there cannot bring the line back. */
const NO_WINDOWS_NOTICE = limitsNotice({ checkedAt: "", windows: [] });

/** Notices worth showing: a provider that reports no windows at all has nothing to act on. */
export function actionableLimitNotices(presentations: LimitPresentations): readonly string[] {
  const notices = collectLimitNotices(presentations);
  if (!NO_WINDOWS_NOTICE) return notices;
  return notices.filter((notice) => !notice.endsWith(`: ${NO_WINDOWS_NOTICE}`));
}

/** The bar's tone by share left: the Mac drawer's calmer green, amber, then red. */
export function usageBarTone(remaining: number): "good" | "low" | "out" {
  if (remaining >= 50) return "good";
  if (remaining >= 20) return "low";
  return "out";
}

/**
 * What the usage sheet says when it has no rows: still checking, no connected machine, or nothing
 * reported; null once there is something to list.
 */
export function no3yUsageSheetState(input: {
  readonly connected: number;
  readonly checked: boolean;
  readonly pools: number;
  readonly notices: number;
  readonly links: number;
}): "checking" | "offline" | "empty" | null {
  if (input.pools > 0 || input.notices > 0 || input.links > 0) return null;
  if (input.connected === 0) return "offline";
  return input.checked ? "empty" : "checking";
}

/**
 * The limit that will interrupt first: the least left, the shorter window on a tie (an unknown
 * duration counts as longest). Null when there is no window.
 */
export function pickBindingUsageWindow<T>(
  windows: ReadonlyArray<T>,
  remainingOf: (window: T) => number,
  durationMinsOf: (window: T) => number | null | undefined,
): T | null {
  let best: T | null = null;
  for (const window of windows) {
    if (best === null) {
      best = window;
      continue;
    }
    const left = remainingOf(window) - remainingOf(best);
    const shorter =
      (durationMinsOf(window) ?? Number.POSITIVE_INFINITY) <
      (durationMinsOf(best) ?? Number.POSITIVE_INFINITY);
    if (left < 0 || (left === 0 && shorter)) best = window;
  }
  return best;
}

/** A window's tiny ring label: 5h, 7d, else its duration in hours or days, else its own label. */
export function ringWindowLabel(window: {
  readonly id: string;
  readonly label: string;
  readonly windowDurationMins?: number | undefined;
}): string {
  const mins = window.windowDurationMins;
  if (window.id === "seven_day") return "7d";
  if (mins === undefined || mins <= 0) return window.label;
  if (mins < 24 * 60) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / (24 * 60))}d`;
}

/**
 * The thread ring's window among one account's: the binding one by pickBindingUsageWindow, with
 * Claude's seven_day_fable breakdown left out as in the sheet. Null when it reports none.
 */
export function no3yRingUsageWindow(
  driver: string,
  windows: ReadonlyArray<ServerProviderUsageWindow>,
): { readonly remainingPercent: number; readonly label: string; readonly id: string } | null {
  const shown = windows.filter(
    (window) => driver !== "claudeAgent" || window.id !== CLAUDE_FABLE_WINDOW_ID,
  );
  const binding = pickBindingUsageWindow(
    shown,
    remainingPercent,
    (window) => window.windowDurationMins,
  );
  return binding === null
    ? null
    : {
        remainingPercent: remainingPercent(binding),
        label: ringWindowLabel(binding),
        id: binding.id,
      };
}

/** The sheet's binding window in a pool, by the ring's rule. */
export function bindingPoolWindow(pool: LimitPool): LimitPoolWindow | null {
  return pickBindingUsageWindow(
    compactTrayWindows(pool),
    (window) => window.remainingPercent,
    uniformWindowDurationMins,
  );
}
