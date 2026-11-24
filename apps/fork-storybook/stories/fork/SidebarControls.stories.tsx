import type { Meta, StoryObj } from "@storybook/react-vite";
import { EnvironmentId } from "@t3tools/contracts";
import type { SidebarProjectSortOrder } from "@t3tools/contracts/settings";
import { type ReactNode, useState } from "react";

import { Menu, MenuPopup, MenuTrigger } from "~/components/ui/menu";
import { Button } from "~/components/ui/button";
import {
  AlarmClockCheckIcon,
  EllipsisIcon,
  PlusIcon,
  SettingsIcon,
  Undo2Icon,
  XIcon,
} from "~/custom/icons/lucide-hugeicons";
import { SidebarDockedMark } from "~/custom/splitThreads/SidebarDockedMark";
import { SidebarSplitPairRow } from "~/custom/splitThreads/SidebarSplitPairRow";
import {
  OptionCheckboxItem,
  ScopeCheckboxItem,
  type SidebarV2ChromeProjectGroup,
  SidebarV2ProjectScopeRow,
  SidebarV2ThreadControls,
} from "~/custom/SidebarV2ChromeRows";
import { SidebarV2IconButton, SidebarV2SlimRowAction } from "~/custom/SidebarV2IconButton";
import { SidebarV2ProjectGroupHeader } from "~/custom/SidebarV2ProjectGroupHeader";
import type { SidebarV2Grouping } from "~/custom/sidebarV2ProjectGrouping";
import { SidebarV2SectionLabel } from "~/custom/SidebarV2SectionLabel";

import { POPUP_ANCHOR, Row, Stack } from "../Specimen.tsx";

const environmentId = EnvironmentId.make("story");

const PROJECTS: ReadonlyArray<SidebarV2ChromeProjectGroup> = [
  ["no3ycode", "violet"],
  ["marketing-site", "emerald"],
  ["dither-studio", "amber"],
].map(([title, color]) => ({
  environmentId,
  workspaceRoot: `/Users/story/${title}`,
  title: title!,
  faviconPath: null,
  projectIcon: {
    kind: "monogram" as const,
    text: title!.slice(0, 1).toUpperCase(),
    color: color as "violet",
  },
  projectKey: title!,
  displayName: title!,
}));

const noop = () => {};

/** The sidebar's own width, so rows that span it read as they do in the app. */
function Column({ children }: { children: ReactNode }) {
  return <div className="w-[288px]">{children}</div>;
}

/** The Threads controls with their state held, as the sidebar holds it. */
function ThreadControls(props: { menuOpen?: boolean; scoped?: boolean; empty?: boolean }) {
  const [scope, setScope] = useState<ReadonlySet<string>>(
    new Set(props.scoped ? ["no3ycode"] : []),
  );
  const [grouping, setGrouping] = useState<SidebarV2Grouping>("project");
  const [compactCards, setCompactCards] = useState(false);
  const [sortOrder, setSortOrder] = useState<SidebarProjectSortOrder>("updated_at");
  const [menuOpen, setMenuOpen] = useState(props.menuOpen ?? false);
  return (
    <SidebarV2ProjectScopeRow
      projectGroups={props.empty ? [] : PROJECTS}
      projectScopeKeys={scope}
      scopedProjectDisplayName={scope.size === 1 ? [...scope][0]! : null}
      onProjectScopeChange={setScope}
      menuOpen={menuOpen}
      onMenuOpenChange={setMenuOpen}
      onProjectActions={noop}
      grouping={grouping}
      onGroupingChange={setGrouping}
      groupByProjectUnavailableReason={null}
      compactCards={compactCards}
      onCompactCardsChange={setCompactCards}
      projectSortOrder={sortOrder}
      onProjectSortOrderChange={setSortOrder}
      onAddProject={noop}
    />
  );
}

const meta = {
  title: "Fork/Sidebar controls",
  component: SidebarV2IconButton,
  tags: ["autodocs"],
  parameters: { surface: "sidebar" },
  args: { box: "row", "aria-label": "More", children: <EllipsisIcon /> },
  argTypes: { box: { control: "inline-radio", options: ["row", "header", "tab"] } },
} satisfies Meta<typeof SidebarV2IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The list's icon-only button, ghost-muted at the list's fixed boxes. */
export const Playground: Story = {};

/** The three boxes (a row's 24px action, a header's 32px, a collapsed tab's round 20px), and a
    slim row's one hover action, bare and with its tooltip. */
export const IconButtons: Story = {
  name: "Icon buttons",
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack gap={3}>
      <Row label="Row">
        <SidebarV2IconButton box="row" aria-label="More">
          <EllipsisIcon />
        </SidebarV2IconButton>
      </Row>
      <Row label="Header">
        <SidebarV2IconButton box="header" aria-label="New thread">
          <PlusIcon />
        </SidebarV2IconButton>
        <SidebarV2IconButton box="header" aria-label="More">
          <EllipsisIcon />
        </SidebarV2IconButton>
      </Row>
      <Row label="Tab">
        <SidebarV2IconButton box="tab" aria-label="Close">
          <XIcon />
        </SidebarV2IconButton>
      </Row>
      <Row label="Slim action">
        <span className="relative flex h-6 w-16 items-center justify-end">
          <SidebarV2SlimRowAction
            label="Settle"
            icon={<AlarmClockCheckIcon />}
            onClick={noop}
            onPointerDown={noop}
          />
        </span>
        <span className="relative flex h-6 w-16 items-center justify-end">
          <SidebarV2SlimRowAction
            label="Un-settle"
            icon={<Undo2Icon />}
            onClick={noop}
            onPointerDown={noop}
            tooltip
          />
        </span>
      </Row>
    </Stack>
  ),
};

/** A section's label, plain or folding its section, open and folded. */
export const SectionLabels: Story = {
  name: "Section labels",
  parameters: { controls: { disable: true } },
  render: function Render() {
    const [collapsed, setCollapsed] = useState(false);
    return (
      <Stack gap={3}>
        <Row label="Plain">
          <SidebarV2SectionLabel testId="story-label">Pinned</SidebarV2SectionLabel>
        </Row>
        <Row label="Folding">
          <SidebarV2SectionLabel
            testId="story-label-toggle"
            collapsed={collapsed}
            onToggle={() => setCollapsed(!collapsed)}
          >
            Threads
          </SidebarV2SectionLabel>
        </Row>
        <Row label="Folded">
          <SidebarV2SectionLabel testId="story-label-folded" collapsed onToggle={noop}>
            Petals
          </SidebarV2SectionLabel>
        </Row>
      </Stack>
    );
  },
};

/** The Threads row: its label folds the list, then Add a project, Sort and the view menu. Sort
    and the menu wait for the first project. */
export const ThreadsRow: Story = {
  name: "Threads row",
  parameters: { surface: "app-sidebar", controls: { disable: true } },
  render: () => (
    <Stack gap={4}>
      <ThreadControls />
      <ThreadControls scoped />
      <ThreadControls empty />
    </Stack>
  ),
};

/** The view menu open: Group by, Compact cards, then the project scope. */
export const ViewMenu: Story = {
  name: "View menu",
  parameters: { surface: "app-sidebar", controls: { disable: true } },
  render: () => (
    <div className="flex justify-end px-2">
      <SidebarV2ThreadControls
        projectGroups={PROJECTS}
        projectScopeKeys={new Set()}
        scopedProjectDisplayName={null}
        onProjectScopeChange={noop}
        menuOpen
        onMenuOpenChange={noop}
        onProjectActions={noop}
        grouping="status"
        onGroupingChange={noop}
        groupByProjectUnavailableReason={null}
        compactCards
        onCompactCardsChange={noop}
        projectSortOrder="updated_at"
        onProjectSortOrderChange={noop}
        onAddProject={noop}
      />
    </div>
  ),
};

/** The menu rows by themselves: a scope row's box leads; an option's trails. */
export const MenuRows: Story = {
  name: "Menu rows",
  parameters: { controls: { disable: true } },
  render: function Render() {
    const [scope, setScope] = useState<ReadonlySet<string>>(new Set(["no3ycode"]));
    const [compact, setCompact] = useState(true);
    const toggle = (key: string) => {
      const next = new Set(scope);
      if (!next.delete(key)) next.add(key);
      setScope(next);
    };
    return (
      <div style={POPUP_ANCHOR}>
        <Menu defaultOpen modal={false}>
          <MenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="View options" />}>
            <SettingsIcon className="size-4" />
          </MenuTrigger>
          <MenuPopup align="start" data-fork-glass-rim className="min-w-56">
            <OptionCheckboxItem
              checked={compact}
              onCheckedChange={setCompact}
              testId="story-compact"
            >
              Compact cards
            </OptionCheckboxItem>
            {PROJECTS.map((project) => (
              <ScopeCheckboxItem
                key={project.projectKey}
                checked={scope.has(project.projectKey)}
                onCheckedChange={() => toggle(project.projectKey)}
              >
                {project.displayName}
              </ScopeCheckboxItem>
            ))}
          </MenuPopup>
        </Menu>
      </div>
    );
  },
};

/** A project's header under Group by project: open, folded, the unresolved project, and with
    its list controls hung beside its own actions. */
export const ProjectHeaders: Story = {
  name: "Project headers",
  parameters: { surface: "app-sidebar", controls: { disable: true } },
  render: function Render() {
    const [collapsed, setCollapsed] = useState(false);
    const header = {
      projectKey: "no3ycode",
      reorderable: false,
      afterOpenSection: true,
      onToggleCollapsed: noop,
      onNewThread: noop,
      onProjectSettings: noop,
      settleAllCount: 3,
      onSettleAllThreads: noop,
    };
    return (
      <ul className="flex flex-col px-2">
        <SidebarV2ProjectGroupHeader
          {...header}
          label="no3ycode"
          isFirst
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed(!collapsed)}
        />
        <SidebarV2ProjectGroupHeader
          {...header}
          projectKey="marketing-site"
          label="marketing-site"
          isFirst={false}
          collapsed
        />
        <SidebarV2ProjectGroupHeader
          {...header}
          projectKey="unknown"
          label={null}
          isFirst={false}
          afterOpenSection={false}
          collapsed={false}
          onNewThread={undefined}
          onProjectSettings={undefined}
        />
        <SidebarV2ProjectGroupHeader
          {...header}
          projectKey="dither-studio"
          label="dither-studio"
          isFirst={false}
          collapsed={false}
          renderTrailingListControls={(onMenuOpenChange) => (
            <SidebarV2ThreadControls
              projectGroups={PROJECTS}
              projectScopeKeys={new Set()}
              scopedProjectDisplayName={null}
              onProjectScopeChange={noop}
              onAnyMenuOpenChange={onMenuOpenChange}
              onProjectActions={noop}
              grouping="project"
              onGroupingChange={noop}
              groupByProjectUnavailableReason={null}
              compactCards={false}
              onCompactCardsChange={noop}
              projectSortOrder="manual"
              onProjectSortOrderChange={noop}
              onAddProject={noop}
            />
          )}
        />
      </ul>
    );
  },
};

/** Stand-in cards, for the pair row's fill and divider. */
function PairCard({ title, docked = false }: { title: string; docked?: boolean }) {
  return (
    <li className="flex h-11 min-w-0 items-center gap-1.5 px-3 text-sm">
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {docked ? <SidebarDockedMark /> : null}
    </li>
  );
}

/** A split pair's two cards on one row, a divider between them; the open pair takes the open
    fill. The docked thread carries the dock mark last in its trailing group. */
export const SplitPair: Story = {
  name: "Split pair",
  parameters: { controls: { disable: true } },
  render: () => (
    <Column>
      <ul className="flex flex-col gap-2">
        <SidebarSplitPairRow projectSection={false} shape="card" active={false}>
          <PairCard title="Fix the tab glide" />
          <PairCard title="Review the glide fix" docked />
        </SidebarSplitPairRow>
        <SidebarSplitPairRow projectSection={false} shape="card" active>
          <PairCard title="Audit the composer" />
          <PairCard title="Capture the before" docked />
        </SidebarSplitPairRow>
        <SidebarSplitPairRow projectSection={false} shape="pill" active>
          <PairCard title="Compact pair" />
          <PairCard title="Its partner" />
        </SidebarSplitPairRow>
      </ul>
    </Column>
  ),
};
