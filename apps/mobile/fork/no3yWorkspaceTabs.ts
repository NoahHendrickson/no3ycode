/**
 * Switching Home's list (Threads, Pull requests) from no3y controls — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`. Home shows the workspace tab state's selected
 * tab; only useSelectWorkspaceTab both resets the stack and selects it. The dock sits outside
 * Home's tab context, so Home's header lends it the selector it was given.
 */
import { useEffect } from "react";

import { useSelectWorkspaceTab } from "../src/features/layout/workspace/useSelectWorkspaceTab";

type SelectWorkspaceTab = ReturnType<typeof useSelectWorkspaceTab>;

let lent: SelectWorkspaceTab | null = null;

/** Home's tab selector, lent to the dock while Home's header has mounted it. */
export function useLendNo3yWorkspaceTabSelect(): SelectWorkspaceTab {
  const select = useSelectWorkspaceTab();
  useEffect(() => {
    lent = select;
  }, [select]);
  return select;
}

/** Selects a Home tab with Home's selector when lent, else only resets the stack to Home. */
export function selectNo3yWorkspaceTab(
  tab: "threads" | "pullRequests",
  fallback: (tab: "threads" | "pullRequests") => void,
): void {
  if (lent) lent(tab);
  else fallback(tab);
}
