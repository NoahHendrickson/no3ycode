import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  EnvironmentId,
  ProviderDriverKind,
  ProviderInstanceId,
  ThreadId,
} from "@t3tools/contracts";

import {
  ComposerBackgroundWorkChip,
  type ComposerBackgroundWorkViewProps,
} from "~/custom/ComposerBackgroundWork";
import { BackgroundWorkLayersMark } from "~/custom/BackgroundWorkLayersMark";
import type { ForkSubagentTreeRow } from "~/custom/forkSubagentTree";

import { Stack } from "../Specimen.tsx";
import { StoryComposer } from "../StoryComposer.tsx";

const SUBAGENT: ForkSubagentTreeRow = {
  id: "subagent-1",
  title: "Research jellyfish",
  titled: true,
  status: "running",
  mark: "working",
  model: "claude-opus-5-5",
  modelSelection: undefined,
  startedAt: new Date(Date.now() - 150_000).toISOString(),
  completedAt: null,
  childThreadId: ThreadId.make("thread-child-1"),
  remote: undefined,
  driver: ProviderDriverKind.make("claudeAgent"),
  providerInstanceId: ProviderInstanceId.make("claudeAgent"),
  statusLabel: "Running",
  prompt: "Research how jellyfish sleep.",
  activity: null,
};

const TASKS: ComposerBackgroundWorkViewProps["items"] = [
  {
    taskId: "subagent-1",
    kind: "subagent",
    label: "Research jellyfish",
    childThreadId: ThreadId.make("thread-child-1"),
    subagent: SUBAGENT,
  },
  { taskId: "monitor-1", kind: "monitor", label: "Watch CI on #377", childThreadId: undefined },
];

const base = {
  stopping: false,
  canStop: true,
  onStop: () => {},
  onOpenThread: () => {},
  environmentId: EnvironmentId.make("story"),
} as const;

const MONITORING: ComposerBackgroundWorkViewProps = {
  ...base,
  items: TASKS.slice(1),
};
const WORKING: ComposerBackgroundWorkViewProps = {
  ...base,
  items: TASKS,
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

/** Several tasks, one task, stopping, and a client with nothing to stop (no square). */
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

/** The chip's mark: the Layers outline with a fill that travels front, middle, back. Reduced
    motion keeps the outline alone. */
export const LayersMark: Story = {
  name: "Layers mark",
  parameters: { surface: "stage", controls: { disable: true } },
  render: () => (
    <span data-fork-composer-status-chip="background-work" className="flex text-foreground">
      <span
        data-fork-liveness-mark
        aria-hidden
        className="flex size-3.5 items-center justify-center"
      >
        <BackgroundWorkLayersMark />
      </span>
    </span>
  ),
};
