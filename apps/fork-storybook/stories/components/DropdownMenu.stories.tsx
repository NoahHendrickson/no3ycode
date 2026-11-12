import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArchiveIcon, ArrowUpDownIcon, CopyIcon, PencilIcon, SettingsIcon } from "lucide-react";
import { userEvent, within } from "storybook/test";

import { Button } from "~/components/ui/button";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "~/components/ui/menu";

const meta = {
  title: "Components/Dropdown menu",
  component: Menu,
  subcomponents: { MenuTrigger, MenuPopup, MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator },
  tags: ["autodocs"],
  parameters: {
    surface: "frame",
    docs: {
      story: { iframeHeight: 300 },
      description: {
        component:
          "How Inlet shows a dropdown: the menu hangs from the icon button that opens it (H3 in `.fork/notes/INLET-STYLE-RULES.md`). `data-fork-tab-trigger` on the button and `data-fork-tab-menu` on the popup are the whole recipe: the button takes the menu's fill, the two join with a concave corner, and the menu grows out of the button. Click the icon to close it.",
      },
    },
  },
  // Opened by a real click, as in the app, so the morph runs.
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
  },
} satisfies Meta<typeof Menu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Menu>
      <MenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="Sort" data-fork-tab-trigger="" />}
      >
        <ArrowUpDownIcon />
      </MenuTrigger>
      <MenuPopup align="end" data-fork-tab-menu="" className="min-w-48">
        <MenuRadioGroup defaultValue="updated">
          <MenuRadioItem value="updated" className="h-8 min-h-8 px-2 py-0 text-sm font-medium">
            Last user message
          </MenuRadioItem>
          <MenuRadioItem value="created" className="h-8 min-h-8 px-2 py-0 text-sm font-medium">
            Created at
          </MenuRadioItem>
          <MenuRadioItem value="manual" className="h-8 min-h-8 px-2 py-0 text-sm font-medium">
            Manual
          </MenuRadioItem>
        </MenuRadioGroup>
      </MenuPopup>
    </Menu>
  ),
};

export const WithIcons: Story = {
  name: "With icons",
  render: () => (
    <Menu>
      <MenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="Thread" data-fork-tab-trigger="" />}
      >
        <SettingsIcon />
      </MenuTrigger>
      <MenuPopup align="end" data-fork-tab-menu="" className="min-w-48">
        <MenuGroup>
          <MenuGroupLabel>Thread</MenuGroupLabel>
          <MenuItem>
            <PencilIcon />
            Rename
          </MenuItem>
          <MenuItem>
            <CopyIcon />
            Copy link
          </MenuItem>
        </MenuGroup>
        {/* Dividers run edge to edge: -mx-1 cancels the popup's 4px padding. */}
        <MenuSeparator className="-mx-1" />
        <MenuItem>
          <ArchiveIcon />
          Archive
        </MenuItem>
      </MenuPopup>
    </Menu>
  ),
};

export const StartAligned: Story = {
  name: "Start aligned",
  render: () => (
    <Menu>
      <MenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="Sort" data-fork-tab-trigger="" />}
      >
        <ArrowUpDownIcon />
      </MenuTrigger>
      <MenuPopup align="start" data-fork-tab-menu="" className="min-w-48">
        <MenuItem>Last user message</MenuItem>
        <MenuItem>Created at</MenuItem>
        <MenuItem>Manual</MenuItem>
      </MenuPopup>
    </Menu>
  ),
};
