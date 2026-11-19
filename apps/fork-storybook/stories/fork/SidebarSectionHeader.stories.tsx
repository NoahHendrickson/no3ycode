import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { SidebarV2StatusSectionHeader } from "~/custom/SidebarV2StatusSectionHeader";
import { SIDEBAR_V2_STATUS_SECTION_LABELS } from "~/custom/sidebarV2StatusGrouping";

import { Row, Stack } from "../Specimen.tsx";

type HeaderProps = Parameters<typeof SidebarV2StatusSectionHeader>[0];

/** The header in the sidebar's list. `hover` forces the hover the caret shows on (the theme keys
    it on the list item, which the component draws itself). */
function Header({ hover = false, ...props }: HeaderProps & { readonly hover?: boolean }) {
  return (
    <ul
      className="w-64 list-none p-0"
      ref={(list) => {
        list?.querySelector("li")?.toggleAttribute("data-story-hover", hover);
      }}
    >
      <SidebarV2StatusSectionHeader {...props} />
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
    section: { control: "select", options: Object.keys(SIDEBAR_V2_STATUS_SECTION_LABELS) },
    collapsed: { control: "boolean" },
  },
  render: function Render(args) {
    const [collapsed, setCollapsed] = useState(args.collapsed);
    return (
      <Header {...args} collapsed={collapsed} onToggleCollapsed={() => setCollapsed(!collapsed)} />
    );
  },
} satisfies Meta<typeof SidebarV2StatusSectionHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** At rest and hovered, open and folded: the caret shows only on hover, pointing at what a click
    does (up to fold, down to open). Matches the Figma kit's Collapsible section header. */
export const States: Story = {
  render: (args) => (
    <Stack gap={3}>
      {([false, true] as const).map((collapsed) =>
        ([false, true] as const).map((hover) => (
          <Row
            key={`${collapsed}-${hover}`}
            label={`${collapsed ? "Folded" : "Open"}${hover ? ", hovered" : ""}`}
          >
            <Header {...args} collapsed={collapsed} hover={hover} />
          </Row>
        )),
      )}
    </Stack>
  ),
};

/** Every section the sidebar groups threads into. */
export const Sections: Story = {
  render: (args) => (
    <Stack gap={1}>
      {(Object.keys(SIDEBAR_V2_STATUS_SECTION_LABELS) as Array<HeaderProps["section"]>).map(
        (section, index) => (
          <Header
            key={section}
            {...args}
            section={section}
            count={index + 1}
            isFirst={index === 0}
          />
        ),
      )}
    </Stack>
  ),
};
