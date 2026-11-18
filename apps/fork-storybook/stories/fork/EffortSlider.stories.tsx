import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProviderDriverKind } from "@t3tools/contracts";
import { useArgs } from "storybook/preview-api";
import { type ComponentProps, useState } from "react";

import { EffortSlider } from "~/custom/ComposerModelPicker";
import { effortDitherStops } from "~/custom/EffortDither";

type SliderProps = ComponentProps<typeof EffortSlider>;

const LEVELS = ["Low", "Medium", "High", "Extra High", "Max", "Ultra"] as const;

const DESCRIPTOR: SliderProps["descriptor"] = {
  id: "reasoningEffort",
  label: "Effort",
  type: "select",
  options: LEVELS.map((label, index) => ({
    id: label.toLowerCase().replace(" ", "-"),
    label,
    ...(index === 2 ? { isDefault: true } : {}),
  })),
};

function Slider({ driver, initial }: { driver: string; initial: number }) {
  const [index, setIndex] = useState(initial);
  return (
    <EffortSlider
      descriptor={DESCRIPTOR}
      fillStops={effortDitherStops(ProviderDriverKind.make(driver))}
      committedIndex={index}
      disabled={false}
      onCommit={(id) => setIndex(DESCRIPTOR.options.findIndex((option) => option.id === id))}
    />
  );
}

const meta = {
  title: "Fork/Effort slider",
  component: EffortSlider,
  tags: ["autodocs"],
  args: {
    descriptor: DESCRIPTOR,
    fillStops: effortDitherStops(ProviderDriverKind.make("codex")),
    committedIndex: 2,
    disabled: false,
    onCommit: () => {},
  },
  parameters: { surface: "page" },
  decorators: [(Story) => <div className="w-72">{Story()}</div>],
} satisfies Meta<typeof EffortSlider>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A pick moves the `committedIndex` control, so the slider keeps the stop it lands on. */
export const Playground: Story = {
  render: function Render(args) {
    const [, updateArgs] = useArgs<SliderProps>();
    return (
      <EffortSlider
        {...args}
        onCommit={(id) =>
          updateArgs({
            committedIndex: args.descriptor.options.findIndex((option) => option.id === id),
          })
        }
      />
    );
  },
};

/** The model picker's effort control: the fill takes the provider's colours. */
export const Providers: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Slider driver="codex" initial={2} />
      <Slider driver="claudeAgent" initial={4} />
    </div>
  ),
};

/** Every stop, from Low to Ultra; the short bar marks the model's default. */
export const Levels: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {LEVELS.map((label, index) => (
        <Slider key={label} driver="codex" initial={index} />
      ))}
    </div>
  ),
};
