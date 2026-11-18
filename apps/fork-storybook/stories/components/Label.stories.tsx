import type { Meta, StoryObj } from "@storybook/react-vite";

import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

import { Row, Stack } from "../Specimen.tsx";

const meta = {
  title: "Components/Label",
  component: Label,
  tags: ["autodocs"],
  args: { children: "Snooze for" },
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Placements: Story = {
  render: () => (
    <Stack gap={5}>
      <Row label="above">
        <div className="flex w-72 flex-col gap-1.5">
          <Label htmlFor="story-label-name">Name</Label>
          <Input id="story-label-name" placeholder="Personal" />
        </div>
      </Row>
      <Row label="wrapping">
        <Label className="flex w-72 flex-col items-stretch" htmlFor="story-label-time">
          Time
          <Input
            nativeInput
            id="story-label-time"
            className="h-9 sm:h-8"
            type="time"
            defaultValue="09:00"
          />
        </Label>
      </Row>
      <Row label="beside checkbox">
        <Label>
          <Checkbox defaultChecked />
          t3code
        </Label>
      </Row>
      <Row label="beside switch">
        <Label>
          <Switch defaultChecked />
          Working section
        </Label>
      </Row>
    </Stack>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-1.5">
      <Label htmlFor="story-label-keybinding">Keybinding</Label>
      <Input id="story-label-keybinding" placeholder="Press shortcut" disabled />
    </div>
  ),
};
