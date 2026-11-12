import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChevronDownIcon, FolderIcon, GitBranchIcon } from "lucide-react";
import { userEvent, within } from "storybook/test";

import { Button } from "~/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "~/components/ui/menu";

const meta = {
  title: "Components/Chip",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    surface: "panel",
    docs: {
      story: { iframeHeight: 280 },
      description: {
        component:
          "A composer context chip: an extra-small ghost `Button` inside the composer's context row (`data-fork-composer-context-row`), which gives it the cream fill and 8px corners. A chip that opens a list marks its popup `data-fork-chip-menu`, and the list hangs from it.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div data-fork-composer-context-row="true" className="flex items-center gap-1">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Button
      size="xs"
      variant="ghost"
      className="min-w-0 max-w-72 font-normal text-muted-foreground/70 text-xs! hover:text-foreground/80 active:scale-100"
      data-composer-context-control
    >
      <GitBranchIcon className="size-3 shrink-0" />
      t3/fork-storybook
    </Button>
  ),
};

export const WithDropdown: Story = {
  name: "With dropdown",
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
  },
  render: () => (
    <Menu>
      <MenuTrigger
        render={
          <Button
            size="xs"
            variant="ghost"
            className="min-w-0 max-w-72 font-normal text-muted-foreground/70 text-xs! hover:text-foreground/80 active:scale-100"
            data-composer-context-control
          />
        }
      >
        <FolderIcon className="size-3 shrink-0" />
        no3ycode
        <ChevronDownIcon className="size-3 shrink-0 opacity-50" />
      </MenuTrigger>
      <MenuPopup align="start" side="top" data-fork-glass-rim data-fork-chip-menu="">
        <MenuItem>no3ycode</MenuItem>
        <MenuItem>portfolio</MenuItem>
        <MenuItem>shaders-lab</MenuItem>
      </MenuPopup>
    </Menu>
  ),
};
