import { type ComponentProps, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useArgs } from "storybook/preview-api";

import { ForkInletColorPicker } from "~/custom/ForkInletColorPicker";
import { ForkSwatchPicker } from "~/custom/ForkSwatchPicker";
import {
  DEFAULT_INLET_COLOR,
  INLET_COLOR_OPTIONS,
  INLET_COLORS,
  type InletColor,
} from "~/custom/forkTheme";

import { Row, Stack } from "../Specimen.tsx";

type PickerProps = ComponentProps<typeof ForkSwatchPicker<InletColor>>;

const INLET_SWATCHES = INLET_COLORS.map((color) => ({
  value: color,
  label: INLET_COLOR_OPTIONS[color].label,
  swatch: INLET_COLOR_OPTIONS[color].swatch,
}));

const meta = {
  title: "Fork/Swatch picker",
  component: ForkSwatchPicker<InletColor>,
  tags: ["autodocs"],
  parameters: { surface: "page" },
  args: {
    label: "Inlet colour",
    options: INLET_SWATCHES,
    value: DEFAULT_INLET_COLOR,
    onChange: () => {},
  },
  argTypes: { value: { control: "select", options: INLET_COLORS } },
} satisfies Meta<typeof ForkSwatchPicker<InletColor>>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A ring marks the pick; each swatch names its colour on hover. Picking moves the `value` control. */
export const Playground: Story = {
  render: function Render(args) {
    const [, updateArgs] = useArgs<PickerProps>();
    return <ForkSwatchPicker {...args} onChange={(value) => updateArgs({ value })} />;
  },
};

/** Where the app uses it: Settings › Appearance, under Inlet. */
export const InSettings: Story = {
  parameters: { controls: { disable: true } },
  render: function Render() {
    const [color, setColor] = useState(DEFAULT_INLET_COLOR);
    return (
      <Stack gap={3}>
        <Row label="Inlet colour">
          <ForkInletColorPicker value={color} onChange={setColor} />
        </Row>
      </Stack>
    );
  },
};
