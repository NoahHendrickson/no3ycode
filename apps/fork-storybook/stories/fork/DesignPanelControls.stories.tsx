import { ArrowDownIcon, ArrowRightIcon, Grid2x2Icon } from "lucide-react";
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  AlignMatrix,
  AlignRow,
  SegmentField,
} from "~/custom/designMode/panel/DesignPanelLayoutControls";
import { PanelSection, PanelToggle } from "~/custom/designMode/panel/DesignPanelFields";

import { Row, Stack } from "../Specimen.tsx";

const DIRECTIONS = [
  { value: "row", label: <ArrowRightIcon />, title: "Row" },
  { value: "column", label: <ArrowDownIcon />, title: "Column" },
] as const;

/** The design panel's own language (Figma's inspector, not the app's Tabs or Button): its
    tokens hang on the panel's marker. */
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div data-fork-design-panel="" className="w-72 bg-background p-3">
      {children}
    </div>
  );
}

const meta = {
  title: "Fork/Design panel controls",
  component: SegmentField,
  tags: ["autodocs"],
  args: { options: DIRECTIONS, value: "row", onSelect: () => {} },
} satisfies Meta<typeof SegmentField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The compact segmented control: flex direction, wrap, text-align. `mixed` lifts no segment. */
export const Segments: Story = {
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <Panel>
        <Stack gap={3}>
          <Row label="Picked">
            <SegmentField {...args} value={value} onSelect={setValue} />
          </Row>
          <Row label="Mixed">
            <SegmentField {...args} value={value} mixed onSelect={setValue} />
          </Row>
        </Stack>
      </Panel>
    );
  },
};

/** Align a selection to its parent, and the flex alignment matrix. */
export const Alignment: Story = {
  render: function Render() {
    const [align, setAlign] = useState({ justifyContent: "flex-start", alignItems: "center" });
    return (
      <Panel>
        <Stack gap={3}>
          <AlignRow caps={{ horizontal: true, vertical: true }} onAlign={() => {}} />
          <AlignMatrix
            direction="row"
            justifyContent={align.justifyContent}
            alignItems={align.alignItems}
            onChange={(justifyContent, alignItems) => setAlign({ justifyContent, alignItems })}
          />
        </Stack>
      </Panel>
    );
  },
};

/** A section with a toggle hung in its header, the way the Figma layouts do. */
export const Section: Story = {
  render: function Render() {
    const [pressed, setPressed] = useState(false);
    return (
      <Panel>
        <PanelSection
          title="Layout"
          action={
            <PanelToggle pressed={pressed} title="Grid" onClick={() => setPressed(!pressed)}>
              <Grid2x2Icon />
            </PanelToggle>
          }
        >
          <SegmentField options={DIRECTIONS} value="row" onSelect={() => {}} />
        </PanelSection>
      </Panel>
    );
  },
};
