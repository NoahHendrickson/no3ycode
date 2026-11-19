import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { EnvironmentId, ProviderDriverKind } from "@t3tools/contracts";

import { SidebarMenu } from "~/components/ui/sidebar";
import { SidebarProviderUpdatesButtonView } from "~/custom/SidebarProviderUpdatesButton";

type Machine = ComponentProps<typeof SidebarProviderUpdatesButtonView>["machines"][number];

const machine = (
  label: string,
  environmentId: string,
  drivers: ReadonlyArray<string>,
): Machine => ({
  environmentId: EnvironmentId.make(environmentId),
  label,
  candidates: drivers.map((driver) => ({ driver: ProviderDriverKind.make(driver) })),
});

const meta = {
  title: "Fork/Sidebar provider updates pill",
  component: SidebarProviderUpdatesButtonView,
  tags: ["autodocs"],
  parameters: { surface: "sidebar" },
  args: { machines: [machine("This Mac", "local", ["codex", "claudeAgent"])], onUpdate: () => {} },
  decorators: [(Story) => <SidebarMenu className="w-52 flex-row">{Story()}</SidebarMenu>],
} satisfies Meta<typeof SidebarProviderUpdatesButtonView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The sidebar footer's provider CLI update button, beside the app's update pill (upstream's
    SidebarUpdatePill, whose round look it shares). The tooltip lists what each machine updates. */
export const Playground: Story = {};

export const SeveralMachines: Story = {
  args: {
    machines: [
      machine("This Mac", "local", ["codex"]),
      machine("Studio", "studio", ["claudeAgent", "cursor"]),
    ],
  },
};
