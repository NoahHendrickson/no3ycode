import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useArgs } from "storybook/preview-api";

import { ForkInletColorPicker } from "~/custom/ForkInletColorPicker";
import { ForkSwatchPicker } from "~/custom/ForkSwatchPicker";
import { ForkBasicTonePicker } from "~/custom/ForkThemePicker";
import { BASIC_TONE_OPTIONS, BASIC_TONES, type BasicTone } from "~/custom/forkTheme";

import { Row, Stack } from "../Specimen.tsx";

type PickerProps = ComponentProps<typeof ForkSwatchPicker<BasicTone>>;

const TONES = BASIC_TONES.map((tone) => ({
  value: tone,
  label: BASIC_TONE_OPTIONS[tone].label,
  swatch: BASIC_TONE_OPTIONS[tone].base,
}));

const meta = {
  title: "Fork/Swatch picker",
  component: ForkSwatchPicker<BasicTone>,
  tags: ["autodocs"],
  args: { label: "Basic tone", options: TONES, value: BASIC_TONES[0], onChange: () => {} },
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
  render: () => (
    <Stack gap={3}>
      <Row label="Basic tone">
        <ForkBasicTonePicker value={BASIC_TONES[0]} onChange={() => {}} />
      </Row>
      <Row label="Inlet colour">
        <ForkInletColorPicker value="cream" onChange={() => {}} />
      </Row>
    </Stack>
  ),
};
