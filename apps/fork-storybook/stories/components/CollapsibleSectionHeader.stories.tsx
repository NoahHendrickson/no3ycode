import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  CollapsibleSectionHeader,
  SectionHeaderStatus,
} from "~/components/ui/collapsible-section-header";

import { forcedStateProps } from "../forcedStates.ts";
import { Matrix } from "../Specimen.tsx";

const TONES = ["muted", "emphasized", "accent"] as const;
const VARIANTS = ["default", "panel"] as const;

const count = (value: number) => <span className="font-normal tabular-nums">{value}</span>;

const meta = {
  title: "Components/Collapsible Section Header",
  component: CollapsibleSectionHeader,
  tags: ["autodocs"],
  parameters: { surface: "sidebar" },
  args: { children: "Working", expanded: true, tone: "muted", variant: "default" },
  argTypes: {
    tone: { control: "select", options: TONES },
    variant: { control: "select", options: VARIANTS },
    expanded: { control: "boolean" },
  },
  render: (args) => (
    <div className="w-64">
      <CollapsibleSectionHeader {...args} />
    </div>
  ),
} satisfies Meta<typeof CollapsibleSectionHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: () => (
    <Matrix
      rows={VARIANTS}
      columns={["expanded", "collapsed", "with accessory"]}
      cell={(variant, column) => (
        <div className="w-56">
          <CollapsibleSectionHeader
            variant={variant}
            expanded={column !== "collapsed"}
            accessory={column === "with accessory" ? count(12) : undefined}
          >
            Settled
          </CollapsibleSectionHeader>
        </div>
      )}
    />
  ),
};

export const Tones: Story = {
  render: () => (
    <Matrix
      rows={TONES}
      columns={["rule", "count"]}
      cell={(tone, column) => (
        <div className="w-56">
          <CollapsibleSectionHeader
            tone={tone}
            expanded
            accessory={column === "count" ? count(3) : undefined}
          >
            Snoozed
          </CollapsibleSectionHeader>
        </div>
      )}
    />
  ),
};

export const States: Story = {
  render: () => (
    <Matrix
      rows={TONES}
      columns={["default", "focus"]}
      cell={(tone, state) => (
        <div className="w-56">
          <CollapsibleSectionHeader tone={tone} expanded {...forcedStateProps(state)}>
            Working
          </CollapsibleSectionHeader>
        </div>
      )}
    />
  ),
};

function SidebarShelves() {
  const [open, setOpen] = useState<Record<string, boolean>>({
    Working: true,
    Snoozed: false,
    Settled: true,
  });
  return (
    <div className="flex w-64 flex-col">
      {(
        [
          ["Working", 3],
          ["Snoozed", 2],
          ["Settled", 18],
        ] as const
      ).map(([label, value]) => (
        <div key={label} className="relative mx-0.5 h-8">
          <CollapsibleSectionHeader
            expanded={open[label] ?? false}
            onClick={() => setOpen((current) => ({ ...current, [label]: !current[label] }))}
            accessory={count(value)}
          >
            {label}
          </CollapsibleSectionHeader>
        </div>
      ))}
    </div>
  );
}

export const SidebarShelfHeaders: Story = {
  name: "Sidebar shelf headers",
  render: () => <SidebarShelves />,
};

export const WorkflowPhases: Story = {
  name: "Workflow phases (panel)",
  render: () => (
    <ul className="m-0 flex w-80 list-none flex-col p-0">
      <li>
        <CollapsibleSectionHeader
          variant="panel"
          tone="emphasized"
          expanded
          accessory={
            <>
              <span className="shrink-0 text-2xs font-normal tabular-nums">1/3 agents</span>
              <span className="shrink-0 text-2xs font-normal tabular-nums">2m 14s</span>
            </>
          }
        >
          Implement
        </CollapsibleSectionHeader>
      </li>
      <li>
        <CollapsibleSectionHeader
          variant="panel"
          expanded={false}
          accessory={
            <>
              <SectionHeaderStatus>Failed</SectionHeaderStatus>
              <span className="shrink-0 text-2xs font-normal tabular-nums">2/2 agents</span>
              <span className="shrink-0 text-2xs font-normal tabular-nums">48s</span>
            </>
          }
        >
          Review
        </CollapsibleSectionHeader>
      </li>
      <li>
        <CollapsibleSectionHeader variant="panel" expanded={false}>
          A long phase title that runs past the width of the panel
        </CollapsibleSectionHeader>
      </li>
    </ul>
  ),
};
