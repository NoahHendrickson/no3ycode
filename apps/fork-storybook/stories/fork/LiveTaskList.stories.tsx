import type { Meta, StoryObj } from "@storybook/react-vite";
import type { OrchestrationV2PlanStep } from "@t3tools/contracts";

import { ForkLiveTaskList } from "~/custom/ForkLiveTaskList";

const STEPS: ReadonlyArray<OrchestrationV2PlanStep> = [
  { id: "read", text: "Read the sidebar's row components", status: "completed" },
  { id: "tokens", text: "Move the row radii onto tokens", status: "completed" },
  { id: "guards", text: "Update the guard tests that pin the old values", status: "running" },
  {
    id: "verify",
    text: "Diff computed styles in every theme against the base branch, story by story",
    status: "pending",
  },
  { id: "pr", text: "Open the pull request", status: "pending" },
];

const meta = {
  title: "Fork/Live task list",
  component: ForkLiveTaskList,
  tags: ["autodocs"],
  args: { steps: STEPS },
  decorators: [
    (Story) => (
      <div className="w-[520px] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ForkLiveTaskList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A running turn's checklist: done steps checked, the current one ringed with a dot, the rest a
    plain ring. Long steps truncate. */
export const Playground: Story = {};
