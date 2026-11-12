import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowUpDownIcon, PlusIcon, SettingsIcon } from "lucide-react";

import { Button } from "~/components/ui/button";

const meta = {
  title: "Components/Icon button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    surface: "frame",
    docs: {
      description: {
        component:
          "A ghost `Button` at an icon size: a rounded square, never a circle, with a filled 16px glyph (H7). `icon` is 32px, `icon-sm` the 28px box. It is the trigger every Inlet dropdown hangs from.",
      },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Button variant="ghost" size="icon" aria-label="Settings">
      <SettingsIcon />
    </Button>
  ),
};

export const Small: Story = {
  render: () => (
    <Button variant="ghost" size="icon-sm" aria-label="Settings">
      <SettingsIcon />
    </Button>
  ),
};

export const Group: Story = {
  render: () => (
    <div className="flex items-center">
      <Button variant="ghost" size="icon" aria-label="Sort">
        <ArrowUpDownIcon />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Settings">
        <SettingsIcon />
      </Button>
      <Button variant="ghost" size="icon" aria-label="New agent">
        <PlusIcon />
      </Button>
    </div>
  ),
};
