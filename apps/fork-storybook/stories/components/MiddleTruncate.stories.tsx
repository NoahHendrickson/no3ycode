import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChevronDownIcon, FolderIcon, GitBranchIcon } from "lucide-react";

import { MiddleTruncate } from "~/components/ui/middle-truncate";

import { Row, Stack } from "../Specimen.tsx";

const BRANCH = "feature/sidebar-thread-row-state-machine";
const PATH = "/Users/dev/code/acme/apps/web-dashboard";
const WIDTHS = [360, 240, 160, 110, 70] as const;

const meta = {
  title: "Components/Middle Truncate",
  component: MiddleTruncate,
  tags: ["autodocs"],
  args: { value: BRANCH, variant: "default", showTitle: true },
  argTypes: {
    variant: { control: "select", options: ["default", "cap-aligned"] },
    tail: { control: "number" },
    showTitle: { control: "boolean" },
  },
  render: (args) => (
    <div className="w-44 rounded-md border px-2 py-1 text-sm">
      <MiddleTruncate {...args} />
    </div>
  ),
} satisfies Meta<typeof MiddleTruncate>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Widths: Story = {
  render: () => (
    <Stack gap={3}>
      {WIDTHS.map((width) => (
        <Row key={width} label={`${width}px`}>
          <div className="rounded-md border px-2 py-1 text-sm" style={{ width }}>
            <MiddleTruncate value={BRANCH} />
          </div>
        </Row>
      ))}
    </Stack>
  ),
};

export const Values: Story = {
  render: () => (
    <Stack gap={3}>
      {(
        [
          ["branch", BRANCH, undefined],
          ["path", PATH, undefined],
          ["no separator", "a-very-long-worktree-name-without-slashes-at-all", undefined],
          ["tail 4", BRANCH, 4],
          ["short value", "main", undefined],
          ["emoji", "feature/🚀-launch-checklist-and-follow-ups", undefined],
        ] as const
      ).map(([label, value, tail]) => (
        <Row key={label} label={label}>
          <div className="w-44 rounded-md border px-2 py-1 text-sm">
            <MiddleTruncate value={value} {...(tail === undefined ? {} : { tail })} />
          </div>
        </Row>
      ))}
    </Stack>
  ),
};

export const Variants: Story = {
  render: () => (
    <Stack gap={3}>
      {(["default", "cap-aligned"] as const).map((variant) => (
        <Row key={variant} label={variant}>
          <div className="flex w-48 items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
            <GitBranchIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <MiddleTruncate value={BRANCH} variant={variant} className="w-full" />
          </div>
        </Row>
      ))}
    </Stack>
  ),
};

export const InPickers: Story = {
  name: "In pickers and menus",
  render: () => (
    <Stack gap={4}>
      <button
        type="button"
        className="flex w-56 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm"
      >
        <MiddleTruncate
          value="origin/release/2026-11-hotfix-checkpoint-restore"
          className="flex-1 text-left"
        />
        <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
      </button>
      <div className="flex w-64 flex-col gap-0.5 rounded-xl border bg-popover p-1 text-sm">
        {[
          "main",
          "feature/composer-slash-commands-and-skills",
          "fix/terminal-resize-flicker-on-split",
        ].map((branch) => (
          <div
            key={branch}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
          >
            <MiddleTruncate value={branch} className="flex-1" />
            <span className="shrink-0 text-3xs text-muted-foreground/45">remote</span>
          </div>
        ))}
      </div>
      <span className="flex w-64 min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <FolderIcon className="size-3.5 shrink-0" />
        <MiddleTruncate value={PATH} />
      </span>
    </Stack>
  ),
};
