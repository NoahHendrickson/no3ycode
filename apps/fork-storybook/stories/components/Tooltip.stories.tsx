import type { Meta, StoryObj } from "@storybook/react-vite";
import { ClockIcon, CopyIcon, PinIcon, TerminalIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { Button } from "~/components/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";

const VARIANTS = ["default", "glass", "code"] as const;
const SIDES = ["top", "bottom", "left", "right"] as const;
const ALIGNS = ["start", "center", "end"] as const;

// Base UI keeps one uncontrolled tooltip open at a time, so the specimen rows hold theirs open.
const spread = (gap: number): CSSProperties => ({ display: "flex", alignItems: "center", gap });

function IconTrigger({ label, children }: { label: string; children: ReactNode }) {
  return (
    <TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label={label} />}>
      {children}
    </TooltipTrigger>
  );
}

const meta = {
  title: "Components/Tooltip",
  component: TooltipPopup,
  tags: ["autodocs"],
  args: { variant: "default", side: "top", align: "center", children: "Snooze thread" },
  argTypes: {
    variant: { control: "select", options: VARIANTS },
    side: { control: "select", options: SIDES },
    align: { control: "select", options: ALIGNS },
  },
} satisfies Meta<typeof TooltipPopup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <Tooltip defaultOpen>
      <IconTrigger label="Snooze thread">
        <ClockIcon />
      </IconTrigger>
      <TooltipPopup {...args} />
    </Tooltip>
  ),
};

export const Variants: Story = {
  render: () => (
    <div style={spread(200)}>
      <Tooltip open>
        <IconTrigger label="Pin thread">
          <PinIcon />
        </IconTrigger>
        <TooltipPopup side="top">Pin thread</TooltipPopup>
      </Tooltip>
      <Tooltip open>
        <IconTrigger label="Copy path">
          <CopyIcon />
        </IconTrigger>
        <TooltipPopup side="top" variant="glass">
          Copy path
        </TooltipPopup>
      </Tooltip>
      <Tooltip open>
        <IconTrigger label="Run script">
          <TerminalIcon />
        </IconTrigger>
        <TooltipPopup side="top" variant="code">
          bun run dev --filter=@t3tools/web
        </TooltipPopup>
      </Tooltip>
    </div>
  ),
};

export const Sides: Story = {
  render: () => (
    <div style={spread(180)}>
      {SIDES.map((side) => (
        <Tooltip key={side} open>
          <TooltipTrigger render={<Button variant="outline" size="sm" />}>{side}</TooltipTrigger>
          <TooltipPopup side={side}>{`side="${side}"`}</TooltipPopup>
        </Tooltip>
      ))}
    </div>
  ),
};

export const Closed: Story = {
  render: () => (
    <Tooltip>
      <IconTrigger label="Snooze thread">
        <ClockIcon />
      </IconTrigger>
      <TooltipPopup>Snooze thread</TooltipPopup>
    </Tooltip>
  ),
};

export const Open: Story = {
  render: () => (
    <Tooltip defaultOpen>
      <IconTrigger label="Snooze thread">
        <ClockIcon />
      </IconTrigger>
      <TooltipPopup>Snooze thread</TooltipPopup>
    </Tooltip>
  ),
};

export const LongContent: Story = {
  name: "Long content",
  render: () => (
    <div style={spread(320)}>
      <Tooltip open>
        <TooltipTrigger render={<Button variant="outline" size="sm" />}>Wrapped</TooltipTrigger>
        <TooltipPopup side="bottom">
          This worktree has uncommitted changes. Archiving the thread keeps them on disk until you
          remove the worktree.
        </TooltipPopup>
      </Tooltip>
      <Tooltip open>
        <TooltipTrigger render={<Button variant="outline" size="sm" />}>Pre-wrap</TooltipTrigger>
        <TooltipPopup side="bottom" className="whitespace-pre-wrap">
          {"Last run failed\nexit code 1 after 4.2s"}
        </TooltipPopup>
      </Tooltip>
    </div>
  ),
};
