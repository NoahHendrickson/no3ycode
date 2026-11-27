import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { CoordinatorDraftToggle } from "~/custom/coordinator/CoordinatorDraftToggle";

import { Stack } from "../Specimen.tsx";
import { StoryComposer } from "../StoryComposer.tsx";

/** The new-thread composer's switch in the chip row over its top-right corner, pressed while the
    draft starts a coordinator. */
function Toggle(props: { readonly on: boolean }) {
  const [on, setOn] = useState(props.on);
  return (
    <div className="w-96">
      <StoryComposer
        prompt="Ask anything"
        statusChips={<CoordinatorDraftToggle on={on} onChange={setOn} disabled={false} />}
      />
    </div>
  );
}

const meta = {
  title: "Fork/Coordinator toggle",
  component: CoordinatorDraftToggle,
  tags: ["autodocs"],
  parameters: { surface: "composer", controls: { disable: true } },
} satisfies Meta<typeof CoordinatorDraftToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Off, then on. */
export const States: Story = {
  args: { on: false, onChange: () => {}, disabled: false },
  render: () => (
    <Stack gap={4}>
      <Toggle on={false} />
      <Toggle on />
    </Stack>
  ),
};
