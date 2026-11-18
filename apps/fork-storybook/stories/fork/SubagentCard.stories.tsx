import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, useState } from "react";

import { ForkSubagentCardView } from "~/custom/ForkSubagentGroup";
import type { ForkSubagentTreeRow } from "~/custom/forkSubagentTree";

import { Stack } from "../Specimen.tsx";

type CardProps = ComponentProps<typeof ForkSubagentCardView>;

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const BASE: ForkSubagentTreeRow = {
  id: "subagent-story",
  title: "Sol review r2: tab strips under Basic",
  status: "running",
  mark: "working",
  model: "gpt-6.2-sol",
  startedAt: minutesAgo(2.5),
  completedAt: null,
  childThreadId: null,
  remote: undefined,
  // Fixture ids: the card only reads them to pick the provider's mark.
  driver: "codex" as ForkSubagentTreeRow["driver"],
  providerInstanceId: "codex" as ForkSubagentTreeRow["providerInstanceId"],
  statusLabel: "Running",
  prompt:
    "Review the tab strips under Basic against the Storybook Tabs. Do not edit, commit or push; reply with a verdict and findings.",
  activity: { label: "Now", text: "apps/web/src/theme.custom.basic.css", shape: "path" },
};

const MEMBERS = {
  Running: BASE,
  Completed: {
    ...BASE,
    id: "subagent-story-done",
    title: "Audit the changed-files card",
    status: "completed",
    mark: "done",
    statusLabel: "Completed",
    driver: "claudeAgent" as ForkSubagentTreeRow["driver"],
    providerInstanceId: "claudeAgent" as ForkSubagentTreeRow["providerInstanceId"],
    model: "claude-opus-5-5",
    startedAt: minutesAgo(10),
    completedAt: minutesAgo(7),
    prompt:
      "Compare the changed-files card in the app with the Basic kit's card and list every difference.",
    activity: {
      label: "Result",
      text: "The well's top corners are square under Basic; everything else matches the kit.",
      shape: "prose",
    },
  },
  Failed: {
    ...BASE,
    id: "subagent-story-failed",
    status: "failed",
    mark: "failed",
    statusLabel: "Failed",
    completedAt: minutesAgo(0.5),
    activity: {
      label: "Result",
      text: "Codex exited before it replied: rate limited",
      shape: "prose",
    },
  },
  Stopped: {
    ...BASE,
    id: "subagent-story-stopped",
    status: "cancelled",
    mark: "stopped",
    statusLabel: "Stopped",
    completedAt: minutesAgo(1),
    activity: null,
  },
} satisfies Record<string, ForkSubagentTreeRow>;

const environmentId = "story" as CardProps["environmentId"];
const noop = () => {};

function Card({ member, initialOpen }: { member: ForkSubagentTreeRow; initialOpen: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <ForkSubagentCardView
      member={member}
      environmentId={environmentId}
      open={open}
      onToggle={() => setOpen(!open)}
      openThread={noop}
    />
  );
}

const meta = {
  title: "Fork/Subagent card",
  component: ForkSubagentCardView,
  tags: ["autodocs"],
  args: { member: BASE, environmentId, open: true, onToggle: noop, openThread: noop },
  argTypes: { open: { control: "boolean" } },
  decorators: [(Story) => <div className="w-[736px]">{Story()}</div>],
} satisfies Meta<typeof ForkSubagentCardView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Each status, folded and open. The well starts open while the subagent works. */
export const Statuses: Story = {
  render: () => (
    <Stack gap={3}>
      {Object.entries(MEMBERS).map(([name, member]) => (
        <Stack key={name} gap={2}>
          <Card member={member} initialOpen={false} />
          <Card member={member} initialOpen />
        </Stack>
      ))}
    </Stack>
  ),
};

/** Without a thread of its own there is nothing to open, so the arrow is not drawn. */
export const WithoutThread: Story = {
  name: "Without a thread",
  args: { open: false },
  render: (args) => <ForkSubagentCardView {...args} openThread={null} />,
};
