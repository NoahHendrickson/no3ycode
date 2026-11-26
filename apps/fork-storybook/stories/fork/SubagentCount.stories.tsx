import type { Meta, StoryObj } from "@storybook/react-vite";

import { SidebarV2SubagentCount } from "~/custom/SidebarV2SubagentCount";

import { Row } from "../Specimen.tsx";

const meta = {
  title: "Fork/Subagent count",
  component: SidebarV2SubagentCount,
  tags: ["autodocs"],
  args: { count: 3 },
} satisfies Meta<typeof SidebarV2SubagentCount>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A thread card's running-subagent mark: the count beside the bot glyph, in caption type. */
export const Playground: Story = {};

/** One, a few and many. */
export const Counts: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Row>
      <SidebarV2SubagentCount count={1} />
      <SidebarV2SubagentCount count={3} />
      <SidebarV2SubagentCount count={12} />
    </Row>
  ),
};
