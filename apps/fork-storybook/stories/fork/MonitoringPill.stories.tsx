import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThreadId } from "@t3tools/contracts";

import { ComposerBackgroundLivenessPill } from "~/custom/ComposerMonitoringPill";

import { Row, Stack } from "../Specimen.tsx";

const TASKS: ComponentProps<typeof ComposerBackgroundLivenessPill>["tasks"] = [
  {
    taskId: "subagent-1",
    kind: "subagent",
    label: "Research jellyfish",
    childThreadId: ThreadId.make("thread-child-1"),
  },
  { taskId: "monitor-1", kind: "monitor", label: "Watch CI on #377", childThreadId: undefined },
];

const shared = { stopping: false, canStop: true, onStop: () => {}, onOpenThread: () => {} };

const meta = {
  title: "Fork/Monitoring pill",
  component: ComposerBackgroundLivenessPill,
  tags: ["autodocs"],
  args: { ...shared, kind: "monitoring", tasks: TASKS },
  // The pill's chrome is drawn for the composer's context row, where it sits in the app.
  decorators: [(Story) => <div data-fork-composer-context-row="true">{Story()}</div>],
} satisfies Meta<typeof ComposerBackgroundLivenessPill>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The composer's background-work pill: its label opens a list of the work (a subagent row opens
    its thread), and the square stops it. */
export const Playground: Story = {};

/** Monitoring and working, stopping, and a client without the operate scope (the square inert). */
export const States: Story = {
  render: (args) => (
    <Stack gap={3}>
      <Row label="Monitoring">
        <ComposerBackgroundLivenessPill {...args} kind="monitoring" />
      </Row>
      <Row label="Working">
        <ComposerBackgroundLivenessPill {...args} kind="working" seed="story" liveCount={2} />
      </Row>
      <Row label="Stopping">
        <ComposerBackgroundLivenessPill {...args} kind="monitoring" stopping />
      </Row>
      <Row label="Cannot stop">
        <ComposerBackgroundLivenessPill {...args} kind="monitoring" canStop={false} />
      </Row>
    </Stack>
  ),
};
