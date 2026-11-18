import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  GlobeIcon,
  SquareSplitHorizontal,
  TerminalSquare,
} from "lucide-react";

import { Kbd, KbdGroup } from "~/components/ui/kbd";

import { Row, Stack } from "../Specimen.tsx";

const VARIANTS = ["default", "outline"] as const;

const meta = {
  title: "Components/Kbd",
  component: Kbd,
  tags: ["autodocs"],
  args: { children: "⌘K", variant: "default" },
  argTypes: {
    variant: { control: "select", options: VARIANTS },
  },
} satisfies Meta<typeof Kbd>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: () => (
    <Stack gap={3}>
      {VARIANTS.map((variant) => (
        <Row key={variant} label={variant}>
          <Kbd variant={variant}>⌘K</Kbd>
          <Kbd variant={variant}>Esc</Kbd>
          <Kbd variant={variant}>Enter</Kbd>
          <Kbd variant={variant}>⇧⌘P</Kbd>
          <Kbd variant={variant}>
            <ArrowUpIcon />
          </Kbd>
          <Kbd variant={variant}>⇥ Tab</Kbd>
        </Row>
      ))}
    </Stack>
  ),
};

export const Group: Story = {
  render: () => (
    <Stack gap={3}>
      <Row label="arrows">
        <KbdGroup>
          <Kbd>
            <ArrowUpIcon />
          </Kbd>
          <Kbd>
            <ArrowDownIcon />
          </Kbd>
        </KbdGroup>
      </Row>
      <Row label="chord">
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>⇧</Kbd>
          <Kbd>P</Kbd>
        </KbdGroup>
      </Row>
    </Stack>
  ),
};

export const CommandPaletteFooter: Story = {
  name: "Command palette footer",
  render: () => (
    <div className="w-[34rem] rounded-xl border bg-popover px-3 py-2 text-xs text-muted-foreground">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        <KbdGroup>
          <Kbd>
            <ArrowUpIcon />
          </Kbd>
          <Kbd>
            <ArrowDownIcon />
          </Kbd>
          <span>Navigate</span>
        </KbdGroup>
        <KbdGroup>
          <Kbd>Enter</Kbd>
          <span>Open</span>
        </KbdGroup>
        <KbdGroup>
          <Kbd>Backspace</Kbd>
          <span>Back</span>
        </KbdGroup>
        <KbdGroup>
          <Kbd>Esc</Kbd>
          <span>Close</span>
        </KbdGroup>
      </div>
    </div>
  ),
};

export const MenuShortcuts: Story = {
  name: "In menu rows",
  render: () => (
    <div className="flex w-60 flex-col gap-0.5 rounded-xl border bg-popover p-1 text-sm">
      {[
        { label: "Terminal", shortcut: "⌘J", Icon: TerminalSquare },
        { label: "Browser", shortcut: "⌘⇧B", Icon: GlobeIcon },
        { label: "Split view", shortcut: "⌘\\", Icon: SquareSplitHorizontal },
      ].map(({ label, shortcut, Icon }) => (
        <div key={label} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent">
          <Icon className="size-4 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <Kbd>{shortcut}</Kbd>
        </div>
      ))}
    </div>
  ),
};

export const InlineHint: Story = {
  name: "Inline in text",
  render: () => (
    <p className="max-w-sm text-sm text-muted-foreground">
      Press <Kbd variant="outline">⇥ Tab</Kbd> to accept the suggestion, or keep typing to ignore
      it.
    </p>
  ),
};
