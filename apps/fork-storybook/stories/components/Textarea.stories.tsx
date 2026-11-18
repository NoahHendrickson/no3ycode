import type { Meta, StoryObj } from "@storybook/react-vite";

import { Label } from "~/components/ui/label";
import { Textarea, type TextareaProps } from "~/components/ui/textarea";

import { FORCED_STATES, forcedStateProps } from "../forcedStates.ts";
import { Matrix, Row, Stack } from "../Specimen.tsx";

const SIZES = ["sm", "default", "lg"] as const satisfies ReadonlyArray<
  Exclude<TextareaProps["size"], number | undefined>
>;
const STATES = FORCED_STATES;
const CONTENT = ["placeholder", "filled", "invalid", "read-only"] as const;
const INSTRUCTIONS = "Keep titles to a few words. Lead with the main subject.";

const meta = {
  title: "Components/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  args: { placeholder: INSTRUCTIONS, size: "default" },
  argTypes: {
    size: { control: "select", options: SIZES },
    rows: { control: "number" },
    disabled: { control: "boolean" },
    readOnly: { control: "boolean" },
    "aria-invalid": { control: "boolean" },
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <div className="w-96">
      <Textarea {...args} />
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <Stack gap={3}>
      {SIZES.map((size) => (
        <Row key={size} label={size}>
          <div className="w-96">
            <Textarea size={size} placeholder="bun test" />
          </div>
        </Row>
      ))}
      <Row label="rows={4}">
        <div className="w-96">
          <Textarea rows={4} placeholder={INSTRUCTIONS} />
        </div>
      </Row>
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
          <Textarea
            {...forcedStateProps(state)}
            placeholder="bun test"
            defaultValue={content === "placeholder" ? undefined : "bun run dev"}
            aria-invalid={content === "invalid" ? true : undefined}
            readOnly={content === "read-only"}
          />
        </div>
      )}
    />
  ),
};

export const Growing: Story = {
  name: "Grows with content",
  render: () => (
    <div className="w-96">
      <Textarea
        defaultValue={
          "Keep titles to a few words.\nLead with the main subject.\nPrefer the feature name over the file name.\nDrop articles and trailing punctuation.\nNever include the provider or model name.\nUse sentence case."
        }
      />
    </div>
  ),
};

export const InAForm: Story = {
  name: "In a form",
  render: () => (
    <div className="grid w-96 gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="story-script-command">Command</Label>
        <Textarea id="story-script-command" placeholder="bun test" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="story-title-instructions">Thread title instructions</Label>
        <Textarea id="story-title-instructions" rows={4} placeholder={INSTRUCTIONS} />
        <p className="text-xs text-muted-foreground">
          Appended to the prompt for new and regenerated thread titles.
        </p>
      </div>
    </div>
  ),
};
