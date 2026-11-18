import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";

import { Input, type InputProps } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

import { FORCED_STATES, forcedStateProps } from "../forcedStates.ts";
import { Matrix, Row, Stack } from "../Specimen.tsx";

const SIZES = ["sm", "compact", "default", "lg"] as const satisfies ReadonlyArray<
  Exclude<InputProps["size"], number | undefined>
>;
const FONTS = ["default", "mono"] as const satisfies ReadonlyArray<InputProps["font"]>;
const STATES = FORCED_STATES;
const CONTENT = ["placeholder", "filled", "invalid", "read-only"] as const;

function Width({ children }: { children: ReactNode }) {
  return <div className="w-72">{children}</div>;
}

const meta = {
  title: "Components/Input",
  component: Input,
  tags: ["autodocs"],
  args: { placeholder: "my.1password.com", size: "default", font: "default" },
  argTypes: {
    size: { control: "select", options: SIZES },
    font: { control: "select", options: FONTS },
    disabled: { control: "boolean" },
    readOnly: { control: "boolean" },
    "aria-invalid": { control: "boolean" },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <Width>
      <Input {...args} />
    </Width>
  ),
};

export const Variants: Story = {
  render: () => (
    <Stack gap={3}>
      {FONTS.map((font) => (
        <Row key={font} label={`font=${font}`}>
          <div className="w-72">
            <Input
              font={font}
              defaultValue={font === "mono" ? "isMac && !inputFocus" : "Personal"}
            />
          </div>
        </Row>
      ))}
      <Row label="unstyled">
        <div className="w-72">
          <Input unstyled placeholder="Search ignored files" />
        </div>
      </Row>
    </Stack>
  ),
};

export const Sizes: Story = {
  render: () => (
    <Stack gap={3}>
      {SIZES.map((size) => (
        <Row key={size} label={size}>
          <div className="w-72">
            <Input size={size} placeholder="http://localhost:5173" />
          </div>
        </Row>
      ))}
    </Stack>
  ),
};

export const States: Story = {
  render: () => (
    <Matrix
      rows={CONTENT}
      columns={STATES}
      cell={(content, state) => (
        <div className="w-36">
          <Input
            {...forcedStateProps(state)}
            placeholder="Personal"
            defaultValue={content === "placeholder" ? undefined : "Personal"}
            aria-invalid={content === "invalid" ? true : undefined}
            readOnly={content === "read-only"}
          />
        </div>
      )}
    />
  ),
};

export const Types: Story = {
  render: () => (
    <Stack gap={3}>
      <Row label="search">
        <div className="w-72">
          <Input size="sm" type="search" placeholder="Search ignored files" />
        </div>
      </Row>
      <Row label="number">
        <div className="w-72">
          <Input type="number" min={1} defaultValue={4} />
        </div>
      </Row>
      <Row label="time (native)">
        <div className="w-72">
          <Input nativeInput type="time" defaultValue="09:00" className="h-9 sm:h-8" />
        </div>
      </Row>
      <Row label="password">
        <div className="w-72">
          <Input type="password" defaultValue="sk-or-v1-placeholder" />
        </div>
      </Row>
      <Row label="file">
        <div className="w-72">
          <Input type="file" />
        </div>
      </Row>
    </Stack>
  ),
};

export const InAForm: Story = {
  name: "In a form",
  render: () => (
    <div className="grid w-80 gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="story-script-name">Name</Label>
        <Input id="story-script-name" placeholder="Test" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="story-script-keybinding">Keybinding</Label>
        <Input id="story-script-keybinding" placeholder="Press shortcut" readOnly />
        <p className="text-xs text-muted-foreground">Press a shortcut. Use Backspace to clear.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="story-script-preview-url">Preview URL (optional)</Label>
        <Input id="story-script-preview-url" placeholder="http://localhost:5173" />
        <p className="text-xs text-muted-foreground">
          Open this URL in the in-app preview when this action runs.
        </p>
      </div>
    </div>
  ),
};
