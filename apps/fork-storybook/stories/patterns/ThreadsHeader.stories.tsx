import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ComponentProps } from "react";
import { userEvent, within } from "storybook/test";

import { SidebarV2ProjectScopeRow } from "~/custom/SidebarV2ChromeRows";

type RowProps = ComponentProps<typeof SidebarV2ProjectScopeRow>;
type Project = RowProps["projectGroups"][number];

const project = (projectKey: string, displayName: string, text: string): Project => ({
  projectKey,
  displayName,
  title: displayName,
  environmentId: "local" as Project["environmentId"],
  workspaceRoot: `/Users/noey/Developer/${projectKey}`,
  faviconPath: null,
  projectIcon: { kind: "monogram", text, color: "emerald" },
});

const PROJECTS = [
  project("no3ycode", "no3ycode", "N3"),
  project("portfolio", "portfolio", "PF"),
  project("shaders-lab", "shaders-lab", "SL"),
];

// The Threads header (custom/SidebarV2ChromeRows.tsx): its settings menu is the reference
// every connected Inlet menu follows (H3 in .fork/notes/INLET-STYLE-RULES.md).
function ThreadsHeader({ settingsOpen }: { settingsOpen: boolean }) {
  const [menuOpen, setMenuOpen] = useState(settingsOpen);
  const [scope, setScope] = useState<ReadonlySet<string>>(new Set());
  const [grouping, setGrouping] = useState<RowProps["grouping"]>("status");
  const [compactCards, setCompactCards] = useState(true);
  const [sortOrder, setSortOrder] = useState<RowProps["projectSortOrder"]>("updated_at");
  return (
    <SidebarV2ProjectScopeRow
      projectGroups={PROJECTS}
      projectScopeKeys={scope}
      scopedProjectDisplayName={null}
      onProjectScopeChange={setScope}
      menuOpen={menuOpen}
      onMenuOpenChange={setMenuOpen}
      onProjectActions={() => {}}
      grouping={grouping}
      onGroupingChange={setGrouping}
      groupByProjectUnavailableReason={null}
      compactCards={compactCards}
      onCompactCardsChange={setCompactCards}
      projectSortOrder={sortOrder}
      onProjectSortOrderChange={setSortOrder}
    />
  );
}

const meta = {
  title: "Patterns/Threads header",
  component: ThreadsHeader,
  args: { settingsOpen: false },
  parameters: { surface: "sidebar" },
} satisfies Meta<typeof ThreadsHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

export const SettingsOpen: Story = {
  name: "Settings open",
  args: { settingsOpen: true },
};

export const SortOpen: Story = {
  name: "Sort open",
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByTestId("sidebar-v2-project-sort"));
  },
};
