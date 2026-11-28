import type { Meta, StoryObj } from "@storybook/react-vite";

import { ActivityIcon, SearchIcon, TargetIcon } from "~/custom/icons/lucide-hugeicons";
import { StarterCard } from "~/custom/StarterCard";

const meta = {
  title: "Fork/Starter card",
  component: StarterCard,
  tags: ["autodocs"],
  args: {
    starters: [
      { key: "plan", label: "Plan this sprint from its goal", Icon: TargetIcon, prompt: "" },
      {
        key: "explore",
        label: "Explore the project and suggest what to work on",
        Icon: SearchIcon,
        prompt: "",
      },
      { key: "status", label: "What's the status of everything?", Icon: ActivityIcon, prompt: "" },
    ],
    onPick: () => {},
  },
  decorators: [
    (Story) => (
      <div className="flex w-[36rem] max-w-full justify-center">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StarterCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An empty thread's ways to start (here, an empty sprint's): a row hands its prompt to the caller. */
export const Playground: Story = {};
