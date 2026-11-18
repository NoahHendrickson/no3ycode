import type { Meta, StoryObj } from "@storybook/react-vite";

import { type SidebarV2CardStatusKind, sidebarV2CardTopStatus } from "~/custom/sidebarV2CardStatus";
import {
  SIDEBAR_V2_WORKING_MARK_FORMS,
  SidebarV2StatusMark,
} from "~/custom/SidebarV2StatusIndicator";
import { FORK_WORKING_MARK_LABELS, FORK_WORKING_MARKS } from "~/custom/forkWorkingMark";

import { Row, Stack } from "../Specimen.tsx";

// Every card status kind, so a new kind fails typecheck until the gallery shows it.
const KINDS: Record<SidebarV2CardStatusKind, true> = {
  working: true,
  waiting: true,
  approval: true,
  input: true,
  request: true,
  limited: true,
  failed: true,
  woke: true,
  done: true,
  monitoring: true,
};

const meta = {
  title: "Fork/Status mark",
  component: SidebarV2StatusMark,
  tags: ["autodocs"],
  parameters: { surface: "sidebar" },
  args: {
    status: sidebarV2CardTopStatus("done", { goalActive: false }),
    seed: "story",
    idle: "dot",
  },
} satisfies Meta<typeof SidebarV2StatusMark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Every mark a thread card, tab or subagent card can show, labelled as the app labels it. */
export const Statuses: Story = {
  render: () => (
    <Stack gap={3}>
      {(Object.keys(KINDS) as SidebarV2CardStatusKind[]).map((kind) => {
        const status = sidebarV2CardTopStatus(kind, { goalActive: false });
        return (
          <Row key={kind} label={status?.label ?? kind}>
            <SidebarV2StatusMark status={status} seed={kind} idle="dot" />
          </Row>
        );
      })}
      <Row label="Goal">
        <SidebarV2StatusMark
          status={sidebarV2CardTopStatus("working", { goalActive: true })}
          seed="goal"
          idle="dot"
        />
      </Row>
      <Row label="Idle">
        <SidebarV2StatusMark status={null} seed="idle" idle="dot" />
      </Row>
      <Row label="Draft">
        <SidebarV2StatusMark status={null} seed="draft" idle="draft" />
      </Row>
    </Stack>
  ),
};

/** The working forms Settings › Appearance offers; the palette picks the default. */
export const WorkingForms: Story = {
  name: "Working forms",
  render: () => (
    <Stack gap={3}>
      {FORK_WORKING_MARKS.map((mark) => {
        const Form = SIDEBAR_V2_WORKING_MARK_FORMS[mark];
        return (
          <Row key={mark} label={FORK_WORKING_MARK_LABELS[mark]}>
            <Form seed={mark} />
          </Row>
        );
      })}
    </Stack>
  ),
};
