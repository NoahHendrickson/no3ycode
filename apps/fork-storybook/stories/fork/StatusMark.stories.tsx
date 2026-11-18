import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  SidebarV2StatusMark,
  type SidebarV2TopStatusMark,
  SidebarV2WorkingBeadRing,
  SidebarV2WorkingHelix,
  SidebarV2WorkingRain,
} from "~/custom/SidebarV2StatusIndicator";

import { Row, Stack } from "../Specimen.tsx";

const STATUSES: ReadonlyArray<readonly [string, SidebarV2TopStatusMark | null]> = [
  ["Working", { label: "Working", mark: "working" }],
  ["Completed", { label: "Completed", mark: "dot", tone: "done" }],
  ["Idle", null],
  ["Needs approval", { label: "Needs approval", mark: "dot", tone: "approval" }],
  ["Needs input", { label: "Needs input", mark: "dot", tone: "input" }],
  ["Failed", { label: "Failed", mark: "dot", tone: "failed" }],
  ["Monitoring", { label: "Monitoring", mark: "monitoring" }],
  ["Woke", { label: "Woke", mark: "woke" }],
];

const meta = {
  title: "Fork/Status mark",
  component: SidebarV2StatusMark,
  tags: ["autodocs"],
  parameters: { surface: "sidebar" },
  args: { status: null, seed: "story", idle: "dot" },
} satisfies Meta<typeof SidebarV2StatusMark>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every status a thread card, a tab or a subagent card can show. */
export const Statuses: Story = {
  render: () => (
    <Stack gap={3}>
      {STATUSES.map(([name, status]) => (
        <Row key={name} label={name}>
          <SidebarV2StatusMark status={status} seed={name} idle="dot" />
        </Row>
      ))}
    </Stack>
  ),
};

/** The three working forms Settings › Appearance offers; the palette picks the default. */
export const WorkingForms: Story = {
  name: "Working forms",
  render: () => (
    <Stack gap={3}>
      <Row label="Rain">
        <SidebarV2WorkingRain seed="rain" />
      </Row>
      <Row label="Bead">
        <SidebarV2WorkingBeadRing seed="bead" />
      </Row>
      <Row label="Helix">
        <SidebarV2WorkingHelix seed="helix" />
      </Row>
    </Stack>
  ),
};
