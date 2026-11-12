import type { Meta, StoryObj } from "@storybook/react-vite";
import { FolderGit2Icon } from "lucide-react";
import { userEvent, within } from "storybook/test";

import { ComposerContextLabel } from "~/components/ComposerContextLabel";
import { ComposerSelectControl } from "~/components/chat/ComposerControl";
import {
  Select,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

const meta = {
  title: "Components/Select",
  component: Select,
  subcomponents: { SelectTrigger, SelectValue, SelectPopup, SelectItem, SelectGroup },
  tags: ["autodocs"],
  parameters: {
    surface: "page",
    docs: {
      story: { iframeHeight: 320 },
      description: {
        component:
          "`components/ui/select` (Base UI Select): the trigger shows the chosen value and a chevron. On Inlet the list hangs from the trigger (H3): `alignItemWithTrigger={false}` opens it below rather than over the trigger, and `data-fork-chip-menu` on the popup joins the two with a concave corner, as the Dropdown menu does. On the composer the trigger is a chip, `ComposerSelectControl` in the context row.",
      },
    },
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

// Opened by a real click, as in the app.
const open: Story["play"] = async ({ canvasElement }) => {
  await userEvent.click(within(canvasElement).getByRole("combobox"));
};

export const Default: Story = {
  render: () => (
    <Select
      defaultValue="inlet"
      items={[
        { value: "westworld", label: "Westworld" },
        { value: "glass", label: "Glass" },
        { value: "inlet", label: "Inlet" },
      ]}
    >
      <SelectTrigger className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectPopup alignItemWithTrigger={false} data-fork-chip-menu="" className="min-w-60">
        <SelectItem value="westworld">Westworld</SelectItem>
        <SelectItem value="glass">Glass</SelectItem>
        <SelectItem value="inlet">Inlet</SelectItem>
      </SelectPopup>
    </Select>
  ),
};

/** The list hangs from the trigger, joined to it by a concave corner. */
export const Open: Story = {
  play: open,
  render: () => (
    <Select
      defaultValue="inlet"
      items={[
        { value: "westworld", label: "Westworld" },
        { value: "glass", label: "Glass" },
        { value: "inlet", label: "Inlet" },
      ]}
    >
      <SelectTrigger className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectPopup alignItemWithTrigger={false} data-fork-chip-menu="" className="min-w-60">
        <SelectItem value="westworld">Westworld</SelectItem>
        <SelectItem value="glass">Glass</SelectItem>
        <SelectItem value="inlet">Inlet</SelectItem>
      </SelectPopup>
    </Select>
  ),
};

export const Small: Story = {
  render: () => (
    <Select
      defaultValue="jungle"
      items={[
        { value: "charcoal", label: "Charcoal" },
        { value: "green", label: "Green" },
        { value: "jungle", label: "Jungle Art" },
      ]}
    >
      <SelectTrigger size="sm" className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectPopup alignItemWithTrigger={false} data-fork-chip-menu="" className="min-w-52">
        <SelectItem value="charcoal">Charcoal</SelectItem>
        <SelectItem value="green">Green</SelectItem>
        <SelectItem value="jungle">Jungle Art</SelectItem>
      </SelectPopup>
    </Select>
  ),
};

export const WithGroups: Story = {
  name: "With groups",
  // The list hangs below the trigger, so the frame needs room for all of it.
  parameters: { docs: { story: { iframeHeight: 580 } } },
  render: () => (
    <Select
      defaultValue="jungle"
      items={[
        { value: "charcoal", label: "Charcoal" },
        { value: "black", label: "Black" },
        { value: "green", label: "Green" },
        { value: "jungle", label: "Jungle Art" },
      ]}
    >
      <SelectTrigger className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectPopup alignItemWithTrigger={false} data-fork-chip-menu="" className="min-w-60">
        <SelectGroup>
          <SelectGroupLabel>Dark</SelectGroupLabel>
          <SelectItem value="charcoal">Charcoal</SelectItem>
          <SelectItem value="black">Black</SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectGroupLabel>Art</SelectGroupLabel>
          <SelectItem value="green">Green</SelectItem>
          <SelectItem value="jungle">Jungle Art</SelectItem>
        </SelectGroup>
      </SelectPopup>
    </Select>
  ),
};

/** The composer's workspace chip (BranchToolbarEnvModeSelector): the list opens above the chip
    and hangs from it. */
export const ComposerChip: Story = {
  name: "Composer chip",
  play: open,
  parameters: { surface: "panel" },
  decorators: [
    (Story) => (
      <div data-fork-composer-context-row="true" className="flex items-center gap-1">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <Select
      modal={false}
      defaultValue="worktree"
      items={[
        { value: "local", label: "Local" },
        { value: "worktree", label: "New worktree" },
      ]}
    >
      <ComposerSelectControl size="xs" aria-label="Workspace" data-composer-context-control>
        <FolderGit2Icon className="size-3" />
        <ComposerContextLabel>
          <SelectValue />
        </ComposerContextLabel>
      </ComposerSelectControl>
      <SelectPopup alignItemWithTrigger={false} side="top" data-fork-chip-menu="">
        <SelectItem value="local">Local</SelectItem>
        <SelectItem value="worktree">New worktree</SelectItem>
      </SelectPopup>
    </Select>
  ),
};
