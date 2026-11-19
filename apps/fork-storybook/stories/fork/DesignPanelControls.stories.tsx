import { ArrowDownIcon, ArrowRightIcon, Grid2x2Icon } from "lucide-react";
import { type ComponentProps, type ReactNode, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useArgs } from "storybook/preview-api";

import {
  AlignMatrix,
  AlignRow,
  SegmentField,
} from "~/custom/designMode/panel/DesignPanelLayoutControls";
import { PanelSection, PanelToggle } from "~/custom/designMode/panel/DesignPanelFields";

import { Row, Stack } from "../Specimen.tsx";

type SegmentProps = ComponentProps<typeof SegmentField>;

const DIRECTIONS = [
  { value: "row", label: <ArrowRightIcon />, title: "Row" },
  { value: "column", label: <ArrowDownIcon />, title: "Column" },
] as const;

/** The design panel's own language (Figma's inspector, not the app's Tabs or Button), at the
    panel's width and surface: its tokens hang on the panel's marker. */
function Panel({ children }: { children: ReactNode }) {
  return (
    <div data-fork-design-panel="" className="w-[325px] bg-[var(--fork-design-surface)] p-3">
      {children}
    </div>
  );
}

const meta = {
  title: "Fork/Design panel controls",
  component: SegmentField,
  subcomponents: { AlignRow, AlignMatrix, PanelSection, PanelToggle },
  tags: ["autodocs"],
  args: { options: DIRECTIONS, value: "row", onSelect: () => {} },
} satisfies Meta<typeof SegmentField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The compact segmented control: flex direction, wrap, text-align. `mixed` lifts no segment.
    Picking moves the `value` control. */
export const Segments: Story = {
  render: function Render(args) {
    const [, updateArgs] = useArgs<SegmentProps>();
    const select = (value: string) => updateArgs({ value });
    return (
      <Panel>
        <Stack gap={3}>
          <Row label="Picked">
            <SegmentField {...args} onSelect={select} />
          </Row>
          <Row label="Mixed">
            <SegmentField {...args} mixed onSelect={select} />
          </Row>
        </Stack>
      </Panel>
    );
  },
};

/** Align a selection to its parent, and the flex alignment matrix at its in-panel width. */
export const Alignment: Story = {
  parameters: { controls: { disable: true } },
  render: function Render() {
    const [align, setAlign] = useState({ justifyContent: "flex-start", alignItems: "center" });
    return (
      <Panel>
        <Stack gap={3}>
          <AlignRow caps={{ horizontal: true, vertical: true }} onAlign={() => {}} />
          <div className="flex items-start gap-2">
            <AlignMatrix
              direction="row"
              justifyContent={align.justifyContent}
              alignItems={align.alignItems}
              onChange={(justifyContent, alignItems) => setAlign({ justifyContent, alignItems })}
            />
          </div>
        </Stack>
      </Panel>
    );
  },
};

/** A section with a toggle hung in its header, the way the Figma layouts do. */
export const Section: Story = {
  parameters: { controls: { disable: true } },
  render: function Render() {
    const [pressed, setPressed] = useState(false);
    const [direction, setDirection] = useState("row");
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
          <SegmentField options={DIRECTIONS} value={direction} onSelect={setDirection} />
        </PanelSection>
      </Panel>
    );
  },
};
