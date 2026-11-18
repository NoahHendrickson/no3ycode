import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Maximize2Icon,
  PanelBottomIcon,
  PanelRightIcon,
  PilcrowIcon,
  TerminalSquare,
  TextWrapIcon,
} from "lucide-react";

import { Toggle } from "~/components/ui/toggle";

import { type ForcedState, forcedStateProps } from "../forcedStates.ts";
import { Matrix, Row, Stack } from "../Specimen.tsx";

const VARIANTS = ["default", "outline", "ghost", "pill", "segmented"] as const;
const SIZES = ["xs", "compact", "segmented", "sm", "default", "lg"] as const;
const COLUMNS = ["default", "hover", "active", "focus", "disabled", "pressed"] as const;
type Column = (typeof COLUMNS)[number];

const columnProps = (column: Column) =>
  column === "pressed" ? { pressed: true } : forcedStateProps(column satisfies ForcedState);

const meta = {
  title: "Components/Toggle",
  component: Toggle,
  tags: ["autodocs"],
  args: { children: "Toggle", variant: "default", size: "default", defaultPressed: false },
  argTypes: {
    variant: { control: "select", options: VARIANTS },
    size: { control: "select", options: SIZES },
    disabled: { control: "boolean" },
    defaultPressed: { control: "boolean" },
  },
} satisfies Meta<typeof Toggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: () => (
    <Stack gap={3}>
      {VARIANTS.map((variant) => (
        <Row key={variant} label={variant}>
          <Toggle variant={variant}>Off</Toggle>
          <Toggle variant={variant} defaultPressed>
            Pressed
          </Toggle>
          <Toggle variant={variant} aria-label="Wrap lines">
            <TextWrapIcon />
          </Toggle>
          <Toggle variant={variant} aria-label="Wrap lines" defaultPressed>
            <TextWrapIcon />
          </Toggle>
        </Row>
      ))}
    </Stack>
  ),
};

export const Sizes: Story = {
  render: () => (
    <Stack gap={3}>
      {SIZES.map((size) => (
        <Row key={size} label={size}>
          <Toggle size={size} variant="outline">
            Toggle
          </Toggle>
          <Toggle size={size} variant="outline" defaultPressed>
            Toggle
          </Toggle>
          <Toggle size={size} variant="ghost" aria-label="Terminal">
            <TerminalSquare />
          </Toggle>
          <Toggle size={size} variant="ghost" aria-label="Terminal" defaultPressed>
            <TerminalSquare />
          </Toggle>
        </Row>
      ))}
    </Stack>
  ),
};

export const States: Story = {
  render: () => (
    <Matrix
      rows={VARIANTS}
      columns={COLUMNS}
      cell={(variant, column) => (
        <Toggle variant={variant} {...columnProps(column)}>
          Toggle
        </Toggle>
      )}
    />
  ),
};

export const PanelControls: Story = {
  name: "Panel layout controls",
  render: () => (
    <div className="flex h-10 items-center gap-1 rounded-lg border px-1.5">
      <Toggle variant="ghost" size="sm" aria-label="Toggle terminal drawer" defaultPressed>
        <PanelBottomIcon />
      </Toggle>
      <Toggle variant="ghost" size="sm" aria-label="Toggle right panel">
        <PanelRightIcon />
      </Toggle>
      <Toggle variant="ghost" size="sm" aria-label="Maximize chat">
        <Maximize2Icon />
      </Toggle>
    </div>
  ),
};

export const DiffToolbar: Story = {
  name: "Diff toolbar toggles",
  render: () => (
    <Row>
      <Toggle aria-label="Enable diff line wrapping" variant="ghost" size="sm" defaultPressed>
        <TextWrapIcon className="size-3.5" />
      </Toggle>
      <Toggle aria-label="Show whitespace" variant="ghost" size="sm">
        <PilcrowIcon className="size-3.5" />
      </Toggle>
      <Toggle aria-label="Match case" size="segmented" variant="segmented" defaultPressed>
        Aa
      </Toggle>
      <Toggle aria-label="Whole word" size="segmented" variant="segmented">
        ab
      </Toggle>
    </Row>
  ),
};
