import type { Meta, StoryObj } from "@storybook/react-vite";
import { SearchIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";

import { Row, Stack } from "../Specimen.tsx";

const SIZES = ["xs", "sm", "md", "lg"] as const;
const TONES = ["current", "muted"] as const;

const meta = {
  title: "Components/Spinner",
  component: Spinner,
  tags: ["autodocs"],
  args: { size: "md", tone: "current" },
  argTypes: {
    size: { control: "select", options: SIZES },
    tone: { control: "select", options: TONES },
  },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
  render: () => (
    <Stack gap={3}>
      {SIZES.map((size) => (
        <Row key={size} label={size}>
          <Spinner size={size} />
          <Spinner size={size} tone="muted" />
        </Row>
      ))}
    </Stack>
  ),
};

export const Tones: Story = {
  render: () => (
    <Stack gap={3}>
      {TONES.map((tone) => (
        <Row key={tone} label={tone}>
          <Spinner size="md" tone={tone} />
          <span className="text-sm text-foreground">
            <Spinner size="sm" tone={tone} className="mr-1.5 inline" />
            Checking…
          </span>
        </Row>
      ))}
    </Stack>
  ),
};

export const InButtons: Story = {
  name: "In buttons",
  render: () => (
    <Stack gap={3}>
      <Row label="leading">
        <Button size="sm" variant="outline" disabled>
          <Spinner size="xs" /> Check account
        </Button>
        <Button size="sm" disabled>
          <Spinner size="xs" /> Save host
        </Button>
      </Row>
      <Row label="unsized">
        <Button variant="outline">
          <Spinner />
          Installing
        </Button>
        <Button size="icon" variant="ghost" aria-label="Searching">
          <Spinner />
        </Button>
      </Row>
    </Stack>
  ),
};

export const LoadingRow: Story = {
  name: "Loading row",
  render: () => (
    <Stack gap={4}>
      <div className="flex w-[28rem] min-h-20 items-center justify-center gap-2 rounded-xl border text-muted-foreground text-sm">
        <Spinner /> Searching themes...
      </div>
      <div className="flex w-[28rem] items-center gap-2 rounded-lg border px-3 py-2 text-sm">
        <Spinner aria-hidden className="text-muted-foreground" />
        <span className="flex-1 text-muted-foreground">Search themes</span>
        <SearchIcon className="size-4 text-muted-foreground opacity-0" />
      </div>
    </Stack>
  ),
};
