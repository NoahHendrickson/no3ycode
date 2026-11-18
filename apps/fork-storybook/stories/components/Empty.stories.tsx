import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ChevronsLeftRightEllipsisIcon,
  Clock3Icon,
  FolderPlusIcon,
  Globe,
  PlusIcon,
  ServerIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { RefreshIcon } from "~/components/ui/refresh-icon";

import { Stack } from "../Specimen.tsx";

const SIZES = ["compact", "default", "hero"] as const;

function Frame({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="flex w-[36rem] flex-col gap-1.5">
      {label ? <span className="font-mono text-[11px] text-muted-foreground">{label}</span> : null}
      <div className="flex rounded-xl border border-dashed border-border">{children}</div>
    </div>
  );
}

const meta = {
  title: "Components/Empty",
  component: Empty,
  tags: ["autodocs"],
  args: { size: "default" },
  argTypes: {
    size: { control: "select", options: SIZES },
  },
  render: (args) => (
    <Frame>
      <Empty {...args}>
        <EmptyMedia variant="icon">
          <Clock3Icon />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>No environments available</EmptyTitle>
          <EmptyDescription>Connect an environment to manage scheduled tasks.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </Frame>
  ),
} satisfies Meta<typeof Empty>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
  parameters: { surface: "bare" },
  render: () => (
    <Stack gap={4}>
      {SIZES.map((size) => (
        <Frame key={size} label={size}>
          <Empty size={size}>
            <EmptyHeader>
              <EmptyTitle>Pick a thread to continue</EmptyTitle>
              <EmptyDescription>
                Select an existing thread or create a new one to get started.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </Frame>
      ))}
    </Stack>
  ),
};

export const MediaVariants: Story = {
  name: "Media variants",
  render: () => (
    <div className="flex flex-col gap-6">
      <Frame label="default">
        <Empty>
          <EmptyMedia>
            <FolderPlusIcon className="size-8 text-muted-foreground" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No projects yet</EmptyTitle>
            <EmptyDescription>Add a folder to start your first thread.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Frame>
      <Frame label="icon">
        <Empty>
          <EmptyMedia variant="icon">
            <ChevronsLeftRightEllipsisIcon />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No saved remote environments</EmptyTitle>
            <EmptyDescription>
              Click “Add environment” to pair another environment.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Frame>
    </div>
  ),
};

export const NoProjects: Story = {
  name: "No projects (hero)",
  render: () => (
    <Frame>
      <Empty size="hero">
        <div className="w-full max-w-lg px-8 py-12">
          <EmptyHeader className="max-w-none">
            <EmptyTitle>What should we work on?</EmptyTitle>
            <EmptyDescription>Add a project, or start without one.</EmptyDescription>
            <div className="mt-6 flex justify-center gap-2">
              <Button size="sm">
                <PlusIcon className="size-4" />
                Add project
              </Button>
              <Button size="sm" variant="outline">
                Start without a project
              </Button>
            </div>
          </EmptyHeader>
        </div>
      </Empty>
    </Frame>
  ),
};

export const PreviewEmpty: Story = {
  name: "Preview, nothing yet",
  render: () => (
    <Frame>
      <Empty>
        <EmptyMedia variant="icon">
          <Globe className="size-4.5 text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle>No preview yet</EmptyTitle>
        <EmptyDescription>
          Type a URL above, or run a dev script. Local servers this thread starts will show up here
          automatically.
        </EmptyDescription>
      </Empty>
    </Frame>
  ),
};

export const DiffUnavailable: Story = {
  name: "Compact with actions",
  render: () => (
    <Frame>
      <Empty size="compact" role="status">
        <div className="flex size-11 items-center justify-center rounded-full bg-warning-surface text-warning">
          <TriangleAlertIcon aria-hidden className="size-5" />
        </div>
        <EmptyHeader>
          <EmptyTitle>Diff unavailable</EmptyTitle>
          <EmptyDescription>
            GitHub did not return the changes for this pull request. It may be too large to load.
          </EmptyDescription>
        </EmptyHeader>
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" variant="default">
            <RefreshIcon />
            Try again
          </Button>
          <Button size="sm" variant="outline">
            Open on GitHub
          </Button>
        </div>
      </Empty>
    </Frame>
  ),
};

export const WithContent: Story = {
  name: "With content",
  render: () => (
    <Frame>
      <Empty size="compact">
        <EmptyMedia variant="icon">
          <ServerIcon />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>No T3 Connect environments</EmptyTitle>
          <EmptyDescription>
            Link an environment from its local Settings to make it available through T3 Connect.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button size="sm" variant="outline">
            <FolderPlusIcon />
            Link an environment
          </Button>
        </EmptyContent>
      </Empty>
    </Frame>
  ),
};
