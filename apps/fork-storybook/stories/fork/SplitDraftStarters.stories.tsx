import type { Meta, StoryObj } from "@storybook/react-vite";

import { DraftId } from "~/composerDraftStore";
import { SplitDraftStarters } from "~/custom/splitThreads/SplitDraftStarters";

const meta = {
  title: "Fork/Split draft starters",
  component: SplitDraftStarters,
  tags: ["autodocs"],
  args: {
    draftId: DraftId.make("draft-split-story"),
    bottomInset: 0,
    onInsert: () => {},
    onFocus: () => {},
  },
  // It fills the empty thread above the composer, so it needs a pane to centre in.
  decorators: [
    (Story) => (
      <div className="relative h-80 w-[36rem] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SplitDraftStarters>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An empty split agent's starters: each row adds its prompt to the composer and focuses it. */
export const Playground: Story = {};
