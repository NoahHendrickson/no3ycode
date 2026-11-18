import type { Meta, StoryObj } from "@storybook/react-vite";
import { GitBranchIcon } from "lucide-react";

import { ScrollArea } from "~/components/ui/scroll-area";

import { Row } from "../Specimen.tsx";

const BRANCHES = [
  "main",
  "develop",
  "feature/sidebar-shelves",
  "feature/composer-slash-commands",
  "fix/terminal-resize-flicker",
  "fix/diff-panel-scroll-restore",
  "chore/bump-effect",
  "feature/preview-design-mode",
  "feature/scheduled-tasks-webhooks",
  "fix/pairing-token-expiry",
  "release/0.12",
  "feature/mobile-thread-search",
  "fix/checkpoint-restore-race",
  "feature/t3-connect-relay",
  "chore/storybook",
  "fix/model-picker-keyboard",
  "feature/usage-limits-pooled",
  "fix/sidebar-drag-drop",
  "feature/pr-guide-tab",
  "fix/glass-backdrop-blur",
] as const;

const COLUMNS = ["Status", "Thread", "Project", "Pull request", "Trigger", "Started", "Duration"];

function BranchList() {
  return (
    <ul className="flex flex-col p-1 text-sm">
      {BRANCHES.map((branch) => (
        <li key={branch} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent">
          <GitBranchIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{branch}</span>
        </li>
      ))}
    </ul>
  );
}

const meta = {
  title: "Components/Scroll Area",
  component: ScrollArea,
  tags: ["autodocs"],
  args: {
    scrollFade: false,
    scrollFadePadding: true,
    scrollbarGutter: false,
    hideScrollbars: false,
    chainVerticalScroll: false,
    radius: "inherit",
  },
  argTypes: {
    scrollFade: { control: "boolean" },
    scrollFadePadding: { control: "boolean" },
    scrollbarGutter: { control: "boolean" },
    hideScrollbars: { control: "boolean" },
    chainVerticalScroll: { control: "boolean" },
    radius: { control: "select", options: ["inherit", "none"] },
  },
  render: (args) => (
    <div className="h-72 w-72 overflow-hidden rounded-xl border bg-popover">
      <ScrollArea {...args}>
        <BranchList />
      </ScrollArea>
    </div>
  ),
} satisfies Meta<typeof ScrollArea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Options: Story = {
  render: () => (
    <Row>
      {(
        [
          ["default", {}],
          ["scrollFade", { scrollFade: true }],
          ["hideScrollbars", { hideScrollbars: true, scrollFade: true }],
          ["scrollbarGutter", { scrollbarGutter: true }],
        ] as const
      ).map(([label, props]) => (
        <div key={label} className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] text-muted-foreground">{label}</span>
          <div className="h-64 w-56 overflow-hidden rounded-xl border bg-popover">
            <ScrollArea {...props}>
              <BranchList />
            </ScrollArea>
          </div>
        </div>
      ))}
    </Row>
  ),
};

// Base UI shows a scrollbar while the area is hovered or scrolling; hover the list to see it.
export const Horizontal: Story = {
  render: () => (
    <div className="w-[26rem] overflow-hidden rounded-xl border bg-card">
      <ScrollArea scrollFade>
        <div className="flex w-max gap-6 px-4 py-3 text-xs text-muted-foreground">
          {[1, 2]
            .flatMap((pass) => COLUMNS.map((column) => `${pass}:${column}`))
            .map((key) => (
              <span key={key} className="whitespace-nowrap">
                {key.slice(2)}
              </span>
            ))}
        </div>
      </ScrollArea>
    </div>
  ),
};
