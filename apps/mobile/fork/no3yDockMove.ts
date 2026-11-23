/**
 * Dock tab switches on no3y iOS are a plain swap — see `.fork/customizations.yaml#no3y-mobile-redesign`:
 * a dock press marks the navigation it causes, and the root stack runs that one without its
 * native push or pop.
 */

/** How long a dock press counts as the cause of the navigation that follows it. */
const SWITCH_WINDOW_MS = 500;

let switchedAt: number | null = null;

export function markNo3yDockSwitch(): void {
  switchedAt = Date.now();
}

/** The root stack's options: no native push or pop for a dock switch. */
export function no3yDockScreenOptions(): { readonly animation?: "none" } {
  return switchedAt !== null && Date.now() - switchedAt <= SWITCH_WINDOW_MS
    ? { animation: "none" }
    : {};
}

// Root routes presented as a formSheet, read from the root stack's config once.
let sheetRoutes: ReadonlySet<string> = new Set();

export function registerNo3ySheetRoutes(names: Iterable<string>): void {
  sheetRoutes = new Set(names);
}

/**
 * The routes the dock reads, beneath any sheets on top. A sheet covers the dock natively, so the
 * dock never hides for one: hiding it would only flash it back in after the dismissal settles.
 */
export function no3yRoutesUnderSheets<Route extends { readonly name: string }>(
  routes: ReadonlyArray<Route>,
  isSheet: (name: string) => boolean = (name) => sheetRoutes.has(name),
): ReadonlyArray<Route> {
  let end = routes.length;
  while (end > 0 && isSheet(routes[end - 1]!.name)) end -= 1;
  return routes.slice(0, end);
}
