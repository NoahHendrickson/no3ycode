import type { Meta, StoryObj } from "@storybook/react-vite";

import { Label } from "~/components/ui/label";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "~/components/ui/number-field";

import { type ForcedState, forcedStateProps } from "../forcedStates.ts";
import { Matrix, Row, Stack } from "../Specimen.tsx";

const SIZES = ["sm", "default", "lg"] as const;
// The group lights up on :focus-within, which the forced-state copier does not map, so focus has
// its own story with a really focused input.
const STATES = [
  "default",
  "hover",
  "active",
  "disabled",
] as const satisfies ReadonlyArray<ForcedState>;
const VALUES = ["empty", "filled", "invalid"] as const;

function Stepper({ label, invalid }: { label: string; invalid?: boolean }) {
  return (
    <NumberFieldGroup>
      <NumberFieldDecrement aria-label={`Decrease ${label}`} />
      <NumberFieldInput aria-label={label} aria-invalid={invalid ? true : undefined} />
      <NumberFieldIncrement aria-label={`Increase ${label}`} />
    </NumberFieldGroup>
  );
}

const meta = {
  title: "Components/Number Field",
  component: NumberField,
  tags: ["autodocs"],
  args: { size: "default", defaultValue: 30, min: 5, step: 5, disabled: false },
  argTypes: {
    size: { control: "select", options: SIZES },
    disabled: { control: "boolean" },
    readOnly: { control: "boolean" },
  },
} satisfies Meta<typeof NumberField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <NumberField {...args} className="w-32">
      <Stepper label="Active host power interval in seconds" />
    </NumberField>
  ),
};

export const Sizes: Story = {
  render: () => (
    <Stack gap={3}>
      {SIZES.map((size) => (
        <Row key={size} label={size}>
          <NumberField size={size} defaultValue={30} min={5} step={5} className="w-32">
            <Stepper label={`${size} interval`} />
          </NumberField>
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
      cell={(value, state) => {
        const forced = forcedStateProps(state);
        const { disabled, ...pointer } = forced;
        return (
          <NumberField
            className="w-32"
            defaultValue={value === "empty" ? undefined : 30}
            disabled={disabled === true}
          >
            <NumberFieldGroup>
              <NumberFieldDecrement aria-label="Decrease" />
              <NumberFieldInput
                aria-label="Amount"
                aria-invalid={value === "invalid" ? true : undefined}
              />
              <NumberFieldIncrement aria-label="Increase" {...pointer} />
            </NumberFieldGroup>
          </NumberField>
        );
      }}
    />
  ),
};

export const Focused: Story = {
  render: () => (
    <NumberField defaultValue={30} min={5} step={5} size="sm" className="w-32">
      <NumberFieldGroup>
        <NumberFieldDecrement aria-label="Decrease" />
        <NumberFieldInput aria-label="Amount" autoFocus />
        <NumberFieldIncrement aria-label="Increase" />
      </NumberFieldGroup>
    </NumberField>
  ),
};

export const SettingsInterval: Story = {
  name: "Settings interval",
  parameters: { surface: "page" },
  render: () => (
    <div className="w-[36rem] overflow-hidden rounded-xl border border-border/60 bg-card/40">
      {[
        {
          title: "Host power monitor",
          description: "Poll host power state while clients are active.",
          value: 30,
          step: 5,
        },
        {
          title: "Idle host monitor",
          description: "Poll host power state when no foreground client is active.",
          value: 300,
          step: 30,
        },
      ].map(({ title, description, value, step }, index) => (
        <div
          key={title}
          className={`flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${index > 0 ? "border-t" : ""}`}
        >
          <div className="min-w-0 space-y-1">
            <div className="text-sm font-medium">{title}</div>
            <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <NumberField defaultValue={value} min={5} step={step} size="sm" className="w-32">
              <Stepper label={`${title.toLowerCase()} interval in seconds`} />
            </NumberField>
            <span className="text-xs text-muted-foreground">seconds</span>
          </div>
        </div>
      ))}
    </div>
  ),
};

export const WithLabel: Story = {
  name: "With label",
  render: () => (
    <div className="w-64">
      <NumberField id="story-snooze-amount" min={0} step="any" defaultValue={2}>
        <Label htmlFor="story-snooze-amount">Snooze for</Label>
        <NumberFieldGroup>
          <NumberFieldDecrement aria-label="Decrease duration" />
          <NumberFieldInput required />
          <NumberFieldIncrement aria-label="Increase duration" />
        </NumberFieldGroup>
      </NumberField>
    </div>
  ),
};
