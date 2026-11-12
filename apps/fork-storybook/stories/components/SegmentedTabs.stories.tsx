import type { Meta, StoryObj } from "@storybook/react-vite";

import { SegmentedTab, SegmentedTabs } from "~/custom/SegmentedTabs";

const meta = {
  title: "Components/Segmented tabs",
  component: SegmentedTabs,
  subcomponents: { SegmentedTab },
  tags: ["autodocs"],
  parameters: {
    surface: "page",
    docs: {
      story: { iframeHeight: 200 },
      description: {
        component:
          "`custom/SegmentedTabs`: a toggle group whose pressed pill glides to the new tab. Shown on the cream utility pages (Automations' trigger tabs).",
      },
    },
  },
} satisfies Meta<typeof SegmentedTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <SegmentedTabs defaultValue={["schedule"]}>
      <SegmentedTab value="schedule">Schedule</SegmentedTab>
      <SegmentedTab value="webhook">Webhook</SegmentedTab>
      <SegmentedTab value="manual">Manual</SegmentedTab>
    </SegmentedTabs>
  ),
};

export const TwoTabs: Story = {
  name: "Two tabs",
  render: () => (
    <SegmentedTabs defaultValue={["week"]}>
      <SegmentedTab value="day">Day</SegmentedTab>
      <SegmentedTab value="week">Week</SegmentedTab>
    </SegmentedTabs>
  ),
};
