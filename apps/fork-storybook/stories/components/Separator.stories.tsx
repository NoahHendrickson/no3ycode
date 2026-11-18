import type { Meta, StoryObj } from "@storybook/react-vite";
import { GitBranchIcon, MonitorIcon } from "lucide-react";

import { Separator } from "~/components/ui/separator";

import { Row, Stack } from "../Specimen.tsx";

const ORIENTATIONS = ["horizontal", "vertical"] as const;

const meta = {
  title: "Components/Separator",
  component: Separator,
  tags: ["autodocs"],
  args: { orientation: "horizontal" },
  argTypes: {
    orientation: { control: "select", options: ORIENTATIONS },
  },
  render: (args) => (
    <div className="flex h-24 w-72 items-center justify-center">
      <Separator {...args} />
    </div>
  ),
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Orientations: Story = {
  render: () => (
    <Stack gap={6}>
      <Row label="horizontal">
        <div className="flex w-72 flex-col gap-3 text-sm">
          <span>Environments</span>
          <Separator />
          <span className="text-muted-foreground">Projects</span>
        </div>
      </Row>
      <Row label="vertical">
        <div className="flex h-8 items-center gap-3 text-sm">
          <span>Local</span>
          <Separator orientation="vertical" />
          <span>Worktree</span>
          <Separator orientation="vertical" />
          <span>Cloud</span>
        </div>
      </Row>
      <Row label="vertical, sized">
        <div className="flex items-center gap-3 text-sm">
          <span>Local</span>
          <Separator orientation="vertical" className="h-4" />
          <span>Worktree</span>
        </div>
      </Row>
    </Stack>
  ),
};

export const InToolbar: Story = {
  name: "In a toolbar",
  render: () => (
    <div className="flex h-8 items-center gap-2 rounded-lg border px-2.5 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <MonitorIcon className="size-3.5" />
        Local
      </span>
      <Separator orientation="vertical" className="h-4" />
      <span className="flex items-center gap-1.5">
        <GitBranchIcon className="size-3.5" />
        feature/sidebar-shelves
      </span>
    </div>
  ),
};
