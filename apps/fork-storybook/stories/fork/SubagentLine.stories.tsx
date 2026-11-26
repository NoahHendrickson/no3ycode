import type { Meta, StoryObj } from "@storybook/react-vite";
import { EnvironmentId, ProviderDriverKind, ProviderInstanceId } from "@t3tools/contracts";

import { ForkSubagentIdentity, ForkSubagentStartLineView } from "~/custom/ForkSubagentGroup";
import type { ForkSubagentTreeRow } from "~/custom/forkSubagentTree";

import { Stack } from "../Specimen.tsx";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const BASE: ForkSubagentTreeRow = {
  id: "subagent-story",
  title: "Sol review r2: tab strips under Basic",
  titled: true,
  status: "running",
  mark: "working",
  model: "gpt-6.2-sol",
  modelSelection: undefined,
  startedAt: minutesAgo(2.5),
  completedAt: null,
  childThreadId: null,
  remote: undefined,
  driver: ProviderDriverKind.make("codex"),
  providerInstanceId: ProviderInstanceId.make("codex"),
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
    driver: ProviderDriverKind.make("claudeAgent"),
    providerInstanceId: ProviderInstanceId.make("claudeAgent"),
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
  Idle: {
    ...BASE,
    id: "subagent-story-idle",
    status: "idle",
    mark: "idle",
    statusLabel: "Idle · resumable",
    completedAt: minutesAgo(1.5),
    activity: {
      label: "Result",
      text: "Found two strips that still use the old track; waiting to be resumed.",
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

const environmentId = EnvironmentId.make("story");
const noop = () => {};

const meta = {
  title: "Fork/Subagent line",
  component: ForkSubagentStartLineView,
  tags: ["autodocs"],
  args: { member: BASE, effort: "High", environmentId, openThread: noop },
  decorators: [(Story) => <div className="w-[736px] min-w-0">{Story()}</div>],
} satisfies Meta<typeof ForkSubagentStartLineView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Each status: the mark in the provider logo's corner says it. */
export const Statuses: Story = {
  render: () => (
    <Stack gap={1}>
      {Object.entries(MEMBERS).map(([name, member]) => (
        <ForkSubagentStartLineView
          key={name}
          member={member}
          effort="High"
          environmentId={environmentId}
          openThread={noop}
        />
      ))}
    </Stack>
  ),
};

/** Without a thread of its own there is nothing to open, so the line is not a button. */
export const WithoutThread: Story = {
  name: "Without a thread",
  render: (args) => <ForkSubagentStartLineView {...args} openThread={null} />,
};

/** The composer's background-work identity: the provider's mark with the status in its corner,
    then the title over the model and effort. */
export const Identity: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack gap={3}>
      {Object.entries(MEMBERS).map(([name, member]) => (
        <div key={name} className="flex w-80 items-center gap-2.5">
          <ForkSubagentIdentity member={member} effort="High" environmentId={environmentId} />
        </div>
      ))}
    </Stack>
  ),
};
