import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "~/components/ui/button";
import { RefreshIcon } from "~/components/ui/refresh-icon";

import { Row, Stack } from "../Specimen.tsx";

const SIZES = ["xs", "sm", "md", "lg"] as const;

const meta = {
  title: "Components/Refresh Icon",
  component: RefreshIcon,
  tags: ["autodocs"],
  args: { size: "md", refreshing: false },
  argTypes: {
    size: { control: "select", options: SIZES },
    refreshing: { control: "boolean" },
  },
} satisfies Meta<typeof RefreshIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
  render: () => (
    <Stack gap={3}>
      {SIZES.map((size) => (
        <Row key={size} label={size}>
          <RefreshIcon size={size} />
          <RefreshIcon size={size} refreshing />
        </Row>
      ))}
    </Stack>
  ),
};

export const States: Story = {
  render: () => (
    <Stack gap={3}>
      <Row label="idle">
        <Button size="sm" variant="outline">
          <RefreshIcon />
          Refresh
        </Button>
        <Button size="icon-xs" variant="ghost" aria-label="Refresh diff">
          <RefreshIcon size="sm" />
        </Button>
      </Row>
      <Row label="refreshing">
        <Button size="sm" variant="outline" disabled>
          <RefreshIcon refreshing />
          Refresh
        </Button>
        <Button size="icon-xs" variant="ghost" aria-label="Refreshing diff" disabled>
          <RefreshIcon size="sm" refreshing />
        </Button>
      </Row>
    </Stack>
  ),
};

export const InButtons: Story = {
  name: "In buttons",
  render: () => (
    <Row>
      <Button size="sm" variant="outline">
        <RefreshIcon size="sm" />
        Scan
      </Button>
      <Button size="sm">
        <RefreshIcon />
        Try again
      </Button>
      <Button variant="outline">
        <RefreshIcon />
        Reinstall theme
      </Button>
    </Row>
  ),
};
