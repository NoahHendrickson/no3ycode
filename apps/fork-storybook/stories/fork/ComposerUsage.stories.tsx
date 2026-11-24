import type { Meta, StoryObj } from "@storybook/react-vite";
import { UsageCircleMeter } from "~/custom/UsageMeter";

import { Row, Stack } from "../Specimen.tsx";

const meta = {
  title: "Fork/Composer usage",
  component: UsageCircleMeter,
  tags: ["autodocs"],
  parameters: { surface: "composer" },
  args: { remaining: 62 },
  argTypes: { remaining: { control: { type: "range", min: 0, max: 100 } } },
} satisfies Meta<typeof UsageCircleMeter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The 12px ring with its 2px band, toned by share left: green from 50%, amber from 20%, red
    under it. No reading draws the empty track alone. */
export const Rings: Story = {
  render: () => (
    <Stack gap={3}>
      {[100, 62, 50, 35, 20, 8, 0].map((remaining) => (
        <Row key={remaining} label={`${remaining}% left`}>
          <UsageCircleMeter remaining={remaining} />
        </Row>
      ))}
      <Row label="No reading">
        <UsageCircleMeter remaining={null} />
      </Row>
    </Stack>
  ),
};
