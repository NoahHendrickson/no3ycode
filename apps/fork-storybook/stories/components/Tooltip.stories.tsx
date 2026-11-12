import type { Meta, StoryObj } from "@storybook/react-vite";
import { SettingsIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";

const meta = {
  title: "Components/Tooltip",
  component: Tooltip,
  subcomponents: { TooltipTrigger, TooltipPopup },
  tags: ["autodocs"],
  parameters: {
    surface: "panel",
    docs: {
      story: { iframeHeight: 220 },
      description: {
        component:
          "`components/ui/tooltip`. Inlet draws it as a pill with a nub whose tip lands on the trigger; beside its trigger (left or right) it has no nub.",
      },
    },
  },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Tooltip defaultOpen>
      <TooltipTrigger render={<Button variant="ghost" size="icon" aria-label="Settings" />}>
        <SettingsIcon />
      </TooltipTrigger>
      <TooltipPopup>Settings</TooltipPopup>
    </Tooltip>
  ),
};

export const Bottom: Story = {
  render: () => (
    <Tooltip defaultOpen>
      <TooltipTrigger render={<Button variant="ghost" size="icon" aria-label="Settings" />}>
        <SettingsIcon />
      </TooltipTrigger>
      <TooltipPopup side="bottom">Settings</TooltipPopup>
    </Tooltip>
  ),
};

export const Side: Story = {
  render: () => (
    <Tooltip defaultOpen>
      <TooltipTrigger render={<Button variant="ghost" size="icon" aria-label="Settings" />}>
        <SettingsIcon />
      </TooltipTrigger>
      <TooltipPopup side="right">Settings</TooltipPopup>
    </Tooltip>
  ),
};
