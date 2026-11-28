/**
 * The sidebar's Sprints section — see `.fork/customizations.yaml#fork-sprints`. The row has the
 * Petals row's shape: a label that folds the section. Its cards are ordinary thread cards, its
 * children.
 */
import type { ReactNode } from "react";

import { SidebarV2ListSection } from "../SidebarV2ListSection";

export function SidebarV2SprintsRow(props: {
  readonly collapsed: boolean;
  readonly onToggleCollapsed: () => void;
  readonly children: ReactNode;
}) {
  return (
    <SidebarV2ListSection
      data-fork-sprints-row=""
      label="Sprints"
      testId="sidebar-v2-sprints-section-toggle"
      collapsed={props.collapsed}
      onToggleCollapsed={props.onToggleCollapsed}
    >
      {props.children}
    </SidebarV2ListSection>
  );
}
