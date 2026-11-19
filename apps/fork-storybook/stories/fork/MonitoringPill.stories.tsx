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

const MONITORING = { ...shared, kind: "monitoring", tasks: TASKS } as const;

// Args live on each story: the props are a union on `kind`, which a shared meta.args can't hold.
const meta: Meta<typeof ComposerBackgroundLivenessPill> = {
  title: "Fork/Monitoring pill",
  component: ComposerBackgroundLivenessPill,
  tags: ["autodocs"],
  // The pill's chrome is drawn for the composer's context row, where it sits in the app.
  decorators: [(Story) => <div data-fork-composer-context-row="true">{Story()}</div>],
};

export default meta;
type Story = StoryObj<typeof ComposerBackgroundLivenessPill>;

/** The composer's background-work pill: its label opens a list of the work (a subagent row opens
    its thread), and the square stops it. */
export const Playground: Story = { args: MONITORING };

/** Monitoring and working, stopping, and a client without the operate scope (the square inert). */
export const States: Story = {
  args: MONITORING,
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack gap={3}>
      <Row label="Monitoring">
        <ComposerBackgroundLivenessPill {...MONITORING} />
      </Row>
      <Row label="Working">
        <ComposerBackgroundLivenessPill
          {...shared}
          tasks={TASKS}
          kind="working"
          seed="story"
          liveCount={2}
        />
      </Row>
      <Row label="Stopping">
        <ComposerBackgroundLivenessPill {...MONITORING} stopping />
      </Row>
      <Row label="Cannot stop">
        <ComposerBackgroundLivenessPill {...MONITORING} canStop={false} />
      </Row>
    </Stack>
  ),
};
