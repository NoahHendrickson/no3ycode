import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlayIcon,
  SquareArrowOutUpRightIcon,
} from "lucide-react";

import { Button } from "~/components/ui/button";
import { Group, GroupSeparator } from "~/components/ui/group";

import { type ForcedState, forcedStateProps } from "../forcedStates.ts";
import { Matrix, Row, Stack } from "../Specimen.tsx";

const ORIENTATIONS = ["horizontal", "vertical"] as const;
const VARIANTS = ["outline", "secondary", "default", "ghost"] as const;
const STATES = [
  "default",
  "hover",
  "active",
  "focus",
  "disabled",
] as const satisfies ReadonlyArray<ForcedState>;

const meta = {
  title: "Components/Button Group",
  component: Group,
  tags: ["autodocs"],
  args: { orientation: "horizontal", children: null },
  argTypes: {
    orientation: { control: "select", options: ORIENTATIONS },
  },
  render: ({ orientation }) => (
    <Group aria-label="Pagination" orientation={orientation}>
      <Button variant="outline" size="sm">
        <ChevronLeftIcon />
        Previous
      </Button>
      <GroupSeparator orientation={orientation === "vertical" ? "horizontal" : "vertical"} />
      <Button variant="outline" size="sm">
        Next
        <ChevronRightIcon />
      </Button>
    </Group>
  ),
} satisfies Meta<typeof Group>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: () => (
    <Stack gap={3}>
      {VARIANTS.map((variant) => (
        <Row key={variant} label={variant}>
          <Group aria-label="Open in editor">
            <Button variant={variant} size="sm">
              <SquareArrowOutUpRightIcon />
              Open
            </Button>
            <GroupSeparator />
            <Button variant={variant} size="icon-sm" aria-label="Choose editor">
              <ChevronDownIcon />
            </Button>
          </Group>
          <Group aria-label="Pagination">
            <Button variant={variant} size="sm">
              Day
            </Button>
            <GroupSeparator />
            <Button variant={variant} size="sm">
              Week
            </Button>
            <GroupSeparator />
            <Button variant={variant} size="sm">
              Month
            </Button>
          </Group>
        </Row>
      ))}
    </Stack>
  ),
};

export const Orientations: Story = {
  render: () => (
    <Row>
      {ORIENTATIONS.map((orientation) => (
        <div key={orientation} className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] text-muted-foreground">{orientation}</span>
          <Group aria-label="Actions" orientation={orientation}>
            <Button variant="outline" size="sm">
              Run
            </Button>
            <GroupSeparator orientation={orientation === "vertical" ? "horizontal" : "vertical"} />
            <Button variant="outline" size="sm">
              Debug
            </Button>
            <GroupSeparator orientation={orientation === "vertical" ? "horizontal" : "vertical"} />
            <Button variant="outline" size="sm">
              Test
            </Button>
          </Group>
        </div>
      ))}
    </Row>
  ),
};

export const States: Story = {
  render: () => (
    <Matrix
      rows={VARIANTS}
      columns={STATES}
      cell={(variant, state) => (
        <Group aria-label="Split button">
          <Button variant={variant} size="sm" {...forcedStateProps(state)}>
            Open
          </Button>
          <GroupSeparator />
          <Button variant={variant} size="icon-sm" aria-label="More">
            <ChevronDownIcon />
          </Button>
        </Group>
      )}
    />
  ),
};

export const SplitButtons: Story = {
  name: "Split buttons (header toolbar)",
  render: () => (
    <Row>
      <Group aria-label="Open in editor">
        <Button variant="outline" size="xs">
          <SquareArrowOutUpRightIcon />
          Cursor
        </Button>
        <GroupSeparator />
        <Button variant="outline" size="icon-xs" aria-label="Choose editor">
          <ChevronDownIcon className="size-4" />
        </Button>
      </Group>
      <Group aria-label="Project scripts">
        <Button variant="outline" size="xs">
          <PlayIcon />
          dev
        </Button>
        <GroupSeparator />
        <Button variant="outline" size="icon-xs" aria-label="Script actions">
          <ChevronDownIcon className="size-4" />
        </Button>
      </Group>
    </Row>
  ),
};
