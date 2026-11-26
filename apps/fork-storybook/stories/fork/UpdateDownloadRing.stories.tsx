import type { Meta, StoryObj } from "@storybook/react-vite";

import { ForkUpdateDownloadRing } from "~/custom/ForkSidebarUpdate";

import { Row } from "../Specimen.tsx";

const meta = {
  title: "Fork/Update download ring",
  component: ForkUpdateDownloadRing,
  tags: ["autodocs"],
  parameters: { surface: "sidebar" },
  args: { percent: 40 },
  argTypes: { percent: { control: { type: "range", min: 0, max: 100, step: 1 } } },
} satisfies Meta<typeof ForkUpdateDownloadRing>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Leads the sidebar's "Update" pill label while the app update downloads, in the label's ink. */
export const Playground: Story = {};

/** Not started (no progress reported yet), partway, and finished. */
export const Progress: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Row>
      <ForkUpdateDownloadRing percent={null} />
      <ForkUpdateDownloadRing percent={10} />
      <ForkUpdateDownloadRing percent={40} />
      <ForkUpdateDownloadRing percent={75} />
      <ForkUpdateDownloadRing percent={100} />
    </Row>
  ),
};
