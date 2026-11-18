import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowRightIcon, PlusIcon, SettingsIcon } from "lucide-react";

import { Button, InlineButton, type ButtonSize, type ButtonVariant } from "~/components/ui/button";

import { type ForcedState, forcedStateProps } from "../forcedStates.ts";
import { Matrix, Row, Stack } from "../Specimen.tsx";

// The variants a screen of ordinary UI uses. media-* and overlay sit on photos and video, and
// glass belongs to the Glass theme, so they live in their own stories below.
const VARIANTS = [
  "default",
  "secondary",
  "outline",
  "ghost",
  "ghost-muted",
  "ghost-destructive",
  "destructive",
  "destructive-outline",
  "warning-outline",
  "link",
] as const satisfies ReadonlyArray<ButtonVariant>;

const TEXT_SIZES = [
  "micro",
  "xs",
  "compact",
  "sm",
  "sm-pill",
  "default",
  "lg",
  "xl",
] as const satisfies ReadonlyArray<ButtonSize>;
const ICON_SIZES = [
  "icon-tiny",
  "icon-micro",
  "icon-xs",
  "icon-sm",
  "icon-sm-pill",
  "icon",
  "icon-lg",
  "icon-xl",
] as const satisfies ReadonlyArray<ButtonSize>;
const STATES = [
  "default",
  "hover",
  "active",
  "focus",
  "disabled",
] as const satisfies ReadonlyArray<ForcedState>;

const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  args: { children: "Button", variant: "default", size: "default" },
  argTypes: {
    variant: { control: "select", options: [...VARIANTS, "glass", "overlay"] },
    size: {
      control: "select",
      options: [...TEXT_SIZES, ...ICON_SIZES, "multiline", "sm-multiline"],
    },
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: () => (
    <Stack gap={3}>
      {VARIANTS.map((variant) => (
        <Row key={variant} label={variant}>
          <Button variant={variant}>Button</Button>
          <Button variant={variant}>
            <PlusIcon />
            Leading icon
          </Button>
          <Button variant={variant}>
            Trailing icon
            <ArrowRightIcon />
          </Button>
          <Button variant={variant} size="icon" aria-label="Settings">
            <SettingsIcon />
          </Button>
        </Row>
      ))}
    </Stack>
  ),
};

export const Sizes: Story = {
  render: () => (
    <Stack gap={3}>
      {TEXT_SIZES.map((size) => (
        <Row key={size} label={size}>
          <Button size={size}>Button</Button>
          <Button size={size} variant="outline">
            <PlusIcon />
            Button
          </Button>
        </Row>
      ))}
      {ICON_SIZES.map((size) => (
        <Row key={size} label={size}>
          <Button size={size} aria-label="Add">
            <PlusIcon />
          </Button>
          <Button size={size} variant="outline" aria-label="Add">
            <PlusIcon />
          </Button>
          <Button size={size} variant="ghost" aria-label="Add">
            <PlusIcon />
          </Button>
        </Row>
      ))}
    </Stack>
  ),
};

export const States: Story = {
  render: () => (
    <Matrix
      rows={VARIANTS}
      columns={STATES}
      cell={(variant, state) => (
        <Button variant={variant} {...forcedStateProps(state)}>
          Button
        </Button>
      )}
    />
  ),
};

export const Multiline: Story = {
  render: () => (
    <div className="flex w-56 flex-col gap-3">
      <Button size="multiline" variant="outline">
        A longer label that wraps onto a second line
      </Button>
      <Button size="sm-multiline" variant="secondary">
        A small label that also wraps when it runs long
      </Button>
    </div>
  ),
};

export const Inline: Story = {
  name: "Inline button",
  render: () => (
    <p className="max-w-sm text-sm text-muted-foreground">
      Text with an <InlineButton>inline action</InlineButton>, a{" "}
      <InlineButton tone="muted">muted one</InlineButton> and a{" "}
      <InlineButton tone="destructive">destructive one</InlineButton>.
    </p>
  ),
};
