import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useArgs } from "storybook/preview-api";

import { ForkThemePicker } from "~/custom/ForkThemePicker";
import { BASIC_TONES, DEFAULT_INLET_COLOR, FORK_PALETTES, INLET_COLORS } from "~/custom/forkTheme";

type PickerProps = ComponentProps<typeof ForkThemePicker>;

const meta = {
  title: "Fork/Theme picker",
  component: ForkThemePicker,
  tags: ["autodocs"],
  parameters: { surface: "page" },
  args: {
    value: FORK_PALETTES[0],
    basicTone: BASIC_TONES[0],
    inletColor: DEFAULT_INLET_COLOR,
    onChange: () => {},
  },
  argTypes: {
    value: { control: "select", options: FORK_PALETTES },
    basicTone: { control: "select", options: BASIC_TONES },
    inletColor: { control: "select", options: INLET_COLORS },
  },
  decorators: [(Story) => <div className="w-[640px]">{Story()}</div>],
} satisfies Meta<typeof ForkThemePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Settings › Appearance's theme cards: a wireframe of each palette, in the tone or colour picked
    for it. Picking a card moves the `value` control. */
export const Playground: Story = {
  render: function Render(args) {
    const [, updateArgs] = useArgs<PickerProps>();
    return <ForkThemePicker {...args} onChange={(value) => updateArgs({ value })} />;
  },
};

/** An upstream theme is applied, so no card is the pick. */
export const NoneActive: Story = { args: { value: null } };
