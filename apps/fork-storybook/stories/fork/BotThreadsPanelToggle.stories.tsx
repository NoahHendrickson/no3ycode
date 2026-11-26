import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { BotThreadsPanelToggleView } from "~/custom/bots/BotThreadsPanelToggle";
import { StageHeaderControls } from "~/custom/stageColumns/StageHeaderControls";

import { Row, Stack } from "../Specimen.tsx";

/** A petal conversation's header, with the toggle at its right end. */
function Header(props: { readonly open: boolean }) {
  const [open, setOpen] = useState(props.open);
  return (
    <div className="flex h-12 w-[560px] max-w-full items-center border-b border-border px-3">
      <span className="truncate text-sm font-medium">Jolly Petal</span>
      <StageHeaderControls>
        <BotThreadsPanelToggleView open={open} onToggle={() => setOpen((current) => !current)} />
      </StageHeaderControls>
    </div>
  );
}

const meta = {
  title: "Fork/Petal threads toggle",
  component: Header,
  tags: ["autodocs"],
  parameters: { surface: "stage" },
  args: { open: false },
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Opens and closes the Threads panel beside a petal's conversation and its work. */
export const Playground: Story = {
  // The header holds open in state; remount it when the control changes.
  render: (args) => <Header key={String(args.open)} {...args} />,
};

/** Closed, and pressed while the panel is open. */
export const States: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack gap={4}>
      <Row label="Closed">
        <Header open={false} />
      </Row>
      <Row label="Open">
        <Header open />
      </Row>
    </Stack>
  ),
};
