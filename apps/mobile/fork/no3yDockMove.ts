/**
 * Which root routes the no3y dock reads — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 */

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
