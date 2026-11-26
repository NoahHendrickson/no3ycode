import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useArgs } from "storybook/preview-api";
import { FolderPlusIcon } from "lucide-react";

import { ArrowUpDownIcon, SettingsIcon } from "~/custom/icons/lucide-hugeicons";
import { SidebarProvider } from "~/components/ui/sidebar";
import { SidebarChromeButton } from "~/custom/SidebarChromeButton";
import { SidebarV2StatusSectionHeader } from "~/custom/SidebarV2StatusSectionHeader";
import {
  SIDEBAR_V2_STATUS_SECTION_LABELS,
  type SidebarV2StatusHeaderKey,
} from "~/custom/sidebarV2StatusGrouping";

import { forcedStateProps } from "../forcedStates.ts";
import { Matrix, Stack } from "../Specimen.tsx";

type HeaderProps = ComponentProps<typeof SidebarV2StatusSectionHeader>;

const SECTIONS = Object.keys(SIDEBAR_V2_STATUS_SECTION_LABELS) as SidebarV2StatusHeaderKey[];

function MockTrailingControls() {
  return (
    <>
      <SidebarChromeButton shape="icon" aria-label="Add a project">
        <FolderPlusIcon className="size-4 shrink-0" />
      </SidebarChromeButton>
      <SidebarChromeButton shape="icon" aria-label="Sort projects">
        <ArrowUpDownIcon weight="stroke" className="size-4 shrink-0" />
      </SidebarChromeButton>
      <SidebarChromeButton shape="icon" aria-label="Filter projects">
        <SettingsIcon className="size-4 shrink-0" />
      </SidebarChromeButton>
    </>
  );
}

/** The header in the sidebar's list. `hover` hovers a row of its section, revealing the trailing
    list controls (`data-fork-section-actions`) just like hovering the header itself. */
function Header({ hover = false, ...props }: HeaderProps & { readonly hover?: boolean }) {
  return (
    // The trailing controls are the real SidebarChromeButton, which reads the sidebar context.
    <SidebarProvider className="min-h-0">
      <ul className="w-64 list-none p-0">
        <SidebarV2StatusSectionHeader renderTrailing={() => <MockTrailingControls />} {...props} />
        {hover ? <li data-fork-status-section="" hidden {...forcedStateProps("hover")} /> : null}
      </ul>
    </SidebarProvider>
  );
}

const meta = {
  title: "Fork/Sidebar section header",
  component: SidebarV2StatusSectionHeader,
  tags: ["autodocs"],
  parameters: { surface: "sidebar" },
  args: {
    section: "working",
    isFirst: true,
    collapsed: false,
    onToggleCollapsed: () => {},
  },
  argTypes: {
    section: { control: "select", options: SECTIONS },
    collapsed: { control: "boolean" },
  },
} satisfies Meta<typeof SidebarV2StatusSectionHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Clicking folds and opens it, kept in step with the `collapsed` control. */
export const Playground: Story = {
  render: function Render(args) {
    const [, updateArgs] = useArgs<HeaderProps>();
    return (
      <Header {...args} onToggleCollapsed={() => updateArgs({ collapsed: !args.collapsed })} />
    );
  },
};

/** At rest and hovered, open and folded: the 12px medium label keeps its chevron always visible
    (down when open, right when folded), while the trailing list controls fade in on hover. */
export const States: Story = {
  render: (args) => (
    <Matrix
      rows={["Open", "Folded"]}
      columns={["rest", "hover"]}
      cell={(row, column) => (
        <Header {...args} collapsed={row === "Folded"} hover={column === "hover"} />
      )}
    />
  ),
};

/** Every section the sidebar groups threads into. */
export const Sections: Story = {
  render: (args) => (
    <Stack gap={1}>
      {SECTIONS.map((section, index) => (
        <Header key={section} {...args} section={section} isFirst={index === 0} />
      ))}
    </Stack>
  ),
};
