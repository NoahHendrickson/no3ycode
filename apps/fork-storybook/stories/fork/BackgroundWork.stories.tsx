import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThreadId } from "@t3tools/contracts";
import { useState } from "react";

import {
  ComposerBackgroundWorkSection,
  ComposerBackgroundWorkToggle,
  type ComposerBackgroundWorkViewProps,
} from "~/custom/ComposerBackgroundWork";
import { ComposerUsageLimitsDrawer } from "~/custom/ComposerUsageLimitsReadout";

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

/** The composer with the work section out above it: the context-row icon and the section's
    collapse share one open state, starting open as it does when work starts. */
function Composer(props: ComposerBackgroundWorkViewProps) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mt-28 w-[736px] max-w-full">
      <StoryComposer
        context={
          <ComposerBackgroundWorkToggle
            {...props}
            open={open}
            onToggle={() => setOpen((current) => !current)}
          />
        }
        topVessel={
          <ComposerUsageLimitsDrawer open={open} onClose={() => setOpen(false)}>
            <ComposerBackgroundWorkSection {...props} onCollapse={() => setOpen(false)} />
          </ComposerUsageLimitsDrawer>
        }
      />
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

/** Subagents and monitors list in the composer's top drawer, a subagent's row opening its thread;
    the icon in the context row shows and hides it. */
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
