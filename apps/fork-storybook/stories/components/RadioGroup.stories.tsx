import type { Meta, StoryObj } from "@storybook/react-vite";
import { LaptopIcon, ServerIcon } from "lucide-react";

import { Radio, RadioGroup } from "~/components/ui/radio-group";

import { FORCED_STATES, forcedStateProps } from "../forcedStates.ts";
import { Matrix } from "../Specimen.tsx";

const STATES = FORCED_STATES;
const VALUES = ["unchecked", "checked", "invalid"] as const;

const meta = {
  title: "Components/Radio Group",
  component: RadioGroup,
  tags: ["autodocs"],
  args: { defaultValue: "personal", disabled: false },
  argTypes: { disabled: { control: "boolean" } },
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <RadioGroup {...args} aria-label="ChatGPT account to connect">
      <label className="flex items-center gap-2 text-sm">
        <Radio value="personal" />
        Personal
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Radio value="work" />
        Work
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Radio value="chatgpt-change-account" />
        Use a different account
      </label>
    </RadioGroup>
  ),
};

export const States: Story = {
  render: () => (
    <Matrix
      rows={VALUES}
      columns={STATES}
      cell={(value, state) => (
        <RadioGroup
          defaultValue={value === "checked" ? "on" : undefined}
          aria-label={`${value} ${state}`}
        >
          <Radio
            {...forcedStateProps(state)}
            value="on"
            aria-invalid={value === "invalid" ? true : undefined}
          />
        </RadioGroup>
      )}
    />
  ),
};

export const AccountPicker: Story = {
  name: "Account picker",
  render: () => (
    <div className="w-96">
      <RadioGroup aria-label="ChatGPT account to connect" defaultValue="noah@example.com">
        {["noah@example.com", "team@example.com"].map((name) => (
          <label
            key={name}
            className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 text-sm"
          >
            <Radio value={name} />
            <span className="min-w-0 break-all font-medium">{name}</span>
          </label>
        ))}
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 text-sm">
          <Radio value="chatgpt-change-account" />
          <span className="font-medium">Use a different account</span>
        </label>
      </RadioGroup>
    </div>
  ),
};

export const MachinePicker: Story = {
  name: "Machine picker",
  render: () => (
    <div className="w-80 space-y-2">
      <span id="story-machine-label" className="block text-xs font-medium">
        Machine
      </span>
      <RadioGroup aria-labelledby="story-machine-label" defaultValue="mac">
        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm">
          <Radio value="mac" />
          <LaptopIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate font-medium">Noah's MacBook Pro</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm">
          <Radio value="devbox" />
          <ServerIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate font-medium">devbox</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm">
          <Radio value="another" />
          <span className="min-w-0 flex-1 font-medium">Another address…</span>
        </label>
      </RadioGroup>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <RadioGroup aria-label="Visibility" defaultValue="private" disabled>
      <label className="flex items-center gap-2 text-sm">
        <Radio value="private" />
        Private
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Radio value="public" />
        Public
      </label>
    </RadioGroup>
  ),
};
