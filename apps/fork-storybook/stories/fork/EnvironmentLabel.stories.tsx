import type { Meta, StoryObj } from "@storybook/react-vite";

import { EnvironmentLabel } from "~/custom/scheduled/scheduledPageChrome";

import { Stack } from "../Specimen.tsx";

const meta = {
  title: "Fork/Environment label",
  component: EnvironmentLabel,
  tags: ["autodocs"],
  parameters: { surface: "page" },
  args: { environment: { label: "Studio Mac mini", serverConfig: null } },
} satisfies Meta<typeof EnvironmentLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An environment's machine mark and name, as the scheduled task pages list where a task runs. */
export const Playground: Story = {};

/** A long name truncates within its column. */
export const LongName: Story = {
  name: "Long name",
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack gap={2}>
      <div className="flex w-48 text-sm">
        <EnvironmentLabel environment={{ label: "Studio Mac mini", serverConfig: null }} />
      </div>
      <div className="flex w-48 text-sm">
        <EnvironmentLabel
          environment={{ label: "build-runner-03.tailnet-example.ts.net", serverConfig: null }}
        />
      </div>
    </Stack>
  ),
};
