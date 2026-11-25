import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";

import {
  ChevronDownIcon,
  EyeIcon,
  FolderIcon,
  FolderPlusIcon,
  GitPullRequestArrowIcon,
  MessageSquareDashedIcon,
} from "~/custom/icons/lucide-hugeicons";
import { ListItem } from "~/custom/ListItem";

const meta = {
  title: "Fork/List item",
  component: ListItem,
  tags: ["autodocs"],
  parameters: { surface: "stage" },
  args: {
    tone: "default",
    children: (
      <>
        <FolderIcon />
        <span className="min-w-0 flex-1 truncate">no3ycode</span>
      </>
    ),
  },
  argTypes: { tone: { control: "inline-radio", options: ["default", "muted"] } },
  decorators: [(Story) => <Card>{Story()}</Card>],
} satisfies Meta<typeof ListItem>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The new agent launchpad's card, which holds these rows. */
function Card({ children }: { children: ReactNode }) {
  return (
    <div
      data-fork-draft-launchpad-card=""
      className="flex w-72 flex-col overflow-hidden rounded-xl border border-border bg-card px-1 py-1"
    >
      {children}
    </div>
  );
}

/** A row in a list that stays on screen, drawn as a menu row. Hover or focus it to see the
    highlight a menu row takes. */
export const Playground: Story = {};

/** The launchpad's project card. Its quiet rows take the muted tone. */
export const Launchpad: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <>
      <ListItem>
        <FolderIcon />
        <span className="min-w-0 flex-1 truncate">no3ycode</span>
      </ListItem>
      <ListItem>
        <FolderIcon />
        <span className="min-w-0 flex-1 truncate">marketing-site</span>
      </ListItem>
      <ListItem tone="muted">
        <MessageSquareDashedIcon />
        <span className="min-w-0 flex-1 truncate">No project</span>
      </ListItem>
      <ListItem tone="muted">
        <FolderPlusIcon />
        <span className="min-w-0 flex-1 truncate">Add a project</span>
      </ListItem>
      <ListItem tone="muted" aria-expanded={false}>
        <ChevronDownIcon className="opacity-60" />
        <span className="min-w-0 flex-1 truncate">All projects (8)</span>
      </ListItem>
    </>
  ),
};

/** Start something new: each suggestion leads with what kind of work it is. */
export const Suggestions: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <>
      <ListItem>
        <EyeIcon />
        <span className="min-w-0 flex-1 truncate">Review the open pull request</span>
      </ListItem>
      <ListItem>
        <GitPullRequestArrowIcon />
        <span className="min-w-0 flex-1 truncate">Open a pull request for t3/design-lint</span>
      </ListItem>
    </>
  ),
};
