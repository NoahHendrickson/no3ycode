import type { Meta, StoryObj } from "@storybook/react-vite";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

import { type ForcedState, forcedStateProps } from "../forcedStates.ts";
import { Matrix, Row, Stack } from "../Specimen.tsx";

const SIZES = ["default", "sm"] as const;
const STATES = [
  "default",
  "hover",
  "active",
  "focus",
  "disabled",
] as const satisfies ReadonlyArray<ForcedState>;
const VALUES = ["off", "on", "mixed"] as const;

const BACKGROUND_OVERRIDES = [
  "Pause when host is locked",
  "Pause on host low power",
  "Pause on client low power",
  "Pause on battery",
] as const;

const meta = {
  title: "Components/Switch",
  component: Switch,
  tags: ["autodocs"],
  args: { size: "default", defaultChecked: true, mixed: false },
  argTypes: {
    size: { control: "select", options: SIZES },
    mixed: { control: "boolean" },
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => <Switch {...args} aria-label="Working section" />,
};

export const Sizes: Story = {
  render: () => (
    <Stack gap={3}>
      {SIZES.map((size) => (
        <Row key={size} label={size}>
          <Switch size={size} aria-label="Off" />
          <Switch size={size} defaultChecked aria-label="On" />
          <Switch size={size} mixed aria-label="Mixed" />
        </Row>
      ))}
    </Stack>
  ),
};

export const States: Story = {
  render: () => (
    <Matrix
      rows={VALUES}
      columns={STATES}
      cell={(value, state) => (
        <Switch
          {...forcedStateProps(state)}
          aria-label={`${value} ${state}`}
          defaultChecked={value === "on"}
          mixed={value === "mixed"}
        />
      )}
    />
  ),
};

export const WithLabel: Story = {
  name: "With label",
  render: () => (
    <Stack gap={3}>
      <Label>
        <Switch defaultChecked />
        Ignore whitespace
      </Label>
      <Label>
        <Switch size="sm" />
        Show skills in / menu
      </Label>
    </Stack>
  ),
};

export const OverrideGrid: Story = {
  name: "Override grid",
  parameters: { surface: "page" },
  render: () => (
    <div className="w-[36rem] overflow-hidden rounded-xl border border-border/60 bg-card/40">
      <div className="grid gap-0 sm:grid-cols-2">
        {BACKGROUND_OVERRIDES.map((label, index) => (
          <label
            key={label}
            className="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0 sm:border-r sm:even:border-r-0"
          >
            <span className="text-sm font-medium">{label}</span>
            <Switch defaultChecked={index % 3 === 0} />
          </label>
        ))}
      </div>
    </div>
  ),
};
