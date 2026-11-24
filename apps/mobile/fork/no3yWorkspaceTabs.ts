/**
 * Home's workspace tab selector (Threads, Pull requests), lent by Home's header to the no3y dock
 * and Settings links, which sit outside its context — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 */
import { useEffect } from "react";

import { useWorkspaceTabs } from "../src/features/layout/workspace/WorkspaceTabsContext";
import { useSelectWorkspaceTab } from "../src/features/layout/workspace/useSelectWorkspaceTab";
import { lendNo3yWorkspaceTabs } from "./no3yHomeTabs";

type SelectWorkspaceTab = ReturnType<typeof useSelectWorkspaceTab>;

/** Home's tab selector, lent to the dock while Home's header has mounted it. */
export function useLendNo3yWorkspaceTabSelect(): SelectWorkspaceTab {
  const select = useSelectWorkspaceTab();
  const isTabActive = useWorkspaceTabs()?.isTabActive;
  useEffect(() => {
    lendNo3yWorkspaceTabs({ select, isShown: (tab) => isTabActive?.(tab) ?? tab === "threads" });
  }, [select, isTabActive]);
  return select;
}
