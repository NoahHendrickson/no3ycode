import { type ComponentProps, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useArgs } from "storybook/preview-api";

import { ForkInletColorPicker } from "~/custom/ForkInletColorPicker";
import { ForkSwatchPicker } from "~/custom/ForkSwatchPicker";
import { BASIC_TONE_SWATCHES, ForkBasicTonePicker } from "~/custom/ForkThemePicker";
import { BASIC_TONES, type BasicTone, DEFAULT_INLET_COLOR } from "~/custom/forkTheme";

import { Row, Stack } from "../Specimen.tsx";

type PickerProps = ComponentProps<typeof ForkSwatchPicker<BasicTone>>;

const meta = {
  title: "Fork/Swatch picker",
  component: ForkSwatchPicker<BasicTone>,
  tags: ["autodocs"],
  parameters: { surface: "page" },
  args: {
    label: "Basic tone",
    options: BASIC_TONE_SWATCHES,
    value: BASIC_TONES[0],
    onChange: () => {},
  },
  argTypes: { value: { control: "select", options: BASIC_TONES } },
} satisfies Meta<typeof ForkSwatchPicker<BasicTone>>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A ring marks the pick; each swatch names its colour on hover. Picking moves the `value` control. */
export const Playground: Story = {
  render: function Render(args) {
    const [, updateArgs] = useArgs<PickerProps>();
    return <ForkSwatchPicker {...args} onChange={(value) => updateArgs({ value })} />;
  },
};

/** Where the app uses it: Settings › Appearance, under Basic and under Inlet. */
export const InSettings: Story = {
  parameters: { controls: { disable: true } },
  render: function Render() {
    const [tone, setTone] = useState<BasicTone>(BASIC_TONES[0]);
    const [color, setColor] = useState(DEFAULT_INLET_COLOR);
    return (
      <Stack gap={3}>
        <Row label="Basic tone">
          <ForkBasicTonePicker value={tone} onChange={setTone} />
        </Row>
        <Row label="Inlet colour">
          <ForkInletColorPicker value={color} onChange={setColor} />
        </Row>
      </Stack>
    );
  },
};
