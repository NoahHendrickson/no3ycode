import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useArgs } from "storybook/preview-api";

import { SidebarV2StatusSectionHeader } from "~/custom/SidebarV2StatusSectionHeader";
import {
  SIDEBAR_V2_STATUS_SECTION_LABELS,
  type SidebarV2StatusHeaderKey,
} from "~/custom/sidebarV2StatusGrouping";

import { forcedStateProps } from "../forcedStates.ts";
import { Matrix, Stack } from "../Specimen.tsx";

type HeaderProps = ComponentProps<typeof SidebarV2StatusSectionHeader>;

const SECTIONS = Object.keys(SIDEBAR_V2_STATUS_SECTION_LABELS) as SidebarV2StatusHeaderKey[];

/** The header in the sidebar's list. `hover` hovers a row of its section, one of the two triggers
    theme.custom.css shows the caret on (the header itself is the other). */
function Header({ hover = false, ...props }: HeaderProps & { readonly hover?: boolean }) {
  return (
    <ul className="w-64 list-none p-0">
      <SidebarV2StatusSectionHeader {...props} />
      {hover ? <li data-fork-status-section="" hidden {...forcedStateProps("hover")} /> : null}
    </ul>
  );
}

const meta = {
  title: "Fork/Sidebar section header",
  component: SidebarV2StatusSectionHeader,
  tags: ["autodocs"],
  parameters: { surface: "sidebar" },
  args: {
    section: "working",
    count: 3,
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

/** At rest and hovered, open and folded: the caret shows only on hover, pointing at what a click
    does (up to fold, down to open). Matches the Figma kit's Collapsible section header. */
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
        <Header key={section} {...args} section={section} count={index + 1} isFirst={index === 0} />
      ))}
    </Stack>
  ),
};
