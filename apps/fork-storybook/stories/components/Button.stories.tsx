import type { Meta, StoryObj } from "@storybook/react-vite";
import { PlusIcon } from "lucide-react";

import { Button } from "~/components/ui/button";

const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  args: { children: "Button" },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "outline", "ghost", "ghost-muted", "destructive"],
    },
    size: { control: "select", options: ["xs", "sm", "default", "lg"] },
  },
  parameters: {
    surface: "panel",
    docs: {
      description: {
        component:
          "`components/ui/button`. Shown on the chat panel, where Jungle Art's light primary reads against the art. Corners are the control radius (8px); a square icon-only button is its own component, Icon button.",
      },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="ghost-muted">Ghost muted</Button>
      <Button variant="destructive">Destructive</Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="xs">Extra small</Button>
      <Button size="sm">Small</Button>
      <Button>Default</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

export const WithIcon: Story = {
  name: "With icon",
  render: () => (
    <Button variant="secondary">
      <PlusIcon />
      New agent
    </Button>
  ),
};

export const Disabled: Story = { args: { disabled: true } };
