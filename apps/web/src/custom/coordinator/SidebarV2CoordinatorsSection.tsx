/**
 * The sidebar's Coordinators section — see `.fork/customizations.yaml#fork-coordinator-threads`.
 * Its cards are ordinary thread cards, its children. No plus: a coordinator starts from the new
 * agent screen's Coordinator pill, or from a thread's menu.
 */
import type { ReactNode } from "react";

import { SidebarV2ListSection } from "../SidebarV2ListSection";

export function SidebarV2CoordinatorsRow(props: {
  readonly collapsed: boolean;
  readonly onToggleCollapsed: () => void;
  readonly children: ReactNode;
}) {
  return (
    <SidebarV2ListSection
      data-fork-coordinators-row=""
      label="Coordinators"
      testId="sidebar-v2-coordinators-section-toggle"
      collapsed={props.collapsed}
      onToggleCollapsed={props.onToggleCollapsed}
    >
      {props.children}
    </SidebarV2ListSection>
  );
}
