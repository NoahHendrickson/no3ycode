import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { CheckboxPill } from "~/custom/CheckboxPill";
import { WorkflowSquare10Icon } from "~/custom/icons/lucide-hugeicons";

import { Row, Stack } from "../Specimen.tsx";

/** One pill, toggling as in the app. */
function Pill(props: {
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly withIcon?: boolean;
}) {
  const [checked, setChecked] = useState(props.checked);
  return (
    <CheckboxPill
      checked={checked}
      onCheckedChange={setChecked}
      disabled={props.disabled === true}
      label="Coordinator"
      {...(props.withIcon === true ? { icon: WorkflowSquare10Icon } : {})}
      tooltip="A checkbox and its label as one control"
    />
  );
}

const meta = {
  title: "Fork/Checkbox pill",
  component: CheckboxPill,
  tags: ["autodocs"],
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof CheckboxPill>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Off, on and disabled, each without and with an icon, on the pill's neutral default surface.
    A caller gives it its own surface (the new-thread Coordinator pill wears the composer card's). */
export const States: Story = {
  args: { checked: false, onCheckedChange: () => {}, label: "Coordinator" },
  render: () => (
    <Stack gap={4}>
      {[false, true].map((withIcon) => (
        <Row key={String(withIcon)}>
          <Pill checked={false} withIcon={withIcon} />
          <Pill checked withIcon={withIcon} />
          <Pill checked disabled withIcon={withIcon} />
        </Row>
      ))}
    </Stack>
  ),
};
