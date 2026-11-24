import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThreadId } from "@t3tools/contracts";

import {
  ComposerBackgroundWorkChip,
  type ComposerBackgroundWorkViewProps,
} from "~/custom/ComposerBackgroundWork";

import { Stack } from "../Specimen.tsx";
import { StoryComposer } from "../StoryComposer.tsx";

const TASKS: ComposerBackgroundWorkViewProps["presentation"]["items"] = [
  {
    taskId: "subagent-1",
    kind: "subagent",
    label: "Research jellyfish",
    childThreadId: ThreadId.make("thread-child-1"),
  },
  { taskId: "monitor-1", kind: "monitor", label: "Watch CI on #377", childThreadId: undefined },
];

const base = {
  seed: "story",
  stopping: false,
  canStop: true,
  onStop: () => {},
  onOpenThread: () => {},
} as const;

const MONITORING: ComposerBackgroundWorkViewProps = {
  ...base,
  presentation: { title: "Monitoring", items: TASKS.slice(1), waiting: false },
};
const WORKING: ComposerBackgroundWorkViewProps = {
  ...base,
  presentation: { title: "Working", items: TASKS, waiting: true },
};

/** The composer with the work chip above it. */
function Composer(props: ComposerBackgroundWorkViewProps) {
  return (
    <div className="mt-28 w-[736px] max-w-full">
      <StoryComposer statusChips={<ComposerBackgroundWorkChip {...props} />} />
    </div>
  );
}

const meta: Meta<typeof Composer> = {
  title: "Fork/Background work",
  component: Composer,
  tags: ["autodocs"],
  parameters: { surface: "composer" },
  args: WORKING,
};

export default meta;
type Story = StoryObj<typeof Composer>;

/** Subagents and monitors ride a chip above the composer; its label lists them, a subagent's row
    opening its thread, and the square stops them. */
export const Playground: Story = {};

/** Working and monitoring, stopping, and a client without the operate scope (Stop inert). */
export const States: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack gap={4}>
      <Composer {...WORKING} />
      <Composer {...MONITORING} />
      <Composer {...MONITORING} stopping />
      <Composer {...MONITORING} canStop={false} />
    </Stack>
  ),
};
