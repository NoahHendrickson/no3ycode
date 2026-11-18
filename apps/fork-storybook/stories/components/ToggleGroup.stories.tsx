import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Columns2Icon, MoonIcon, Rows3Icon, SunIcon } from "lucide-react";

import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";

import { FORCED_STATES, forcedStateProps } from "../forcedStates.ts";
import { Matrix, Row, Stack } from "../Specimen.tsx";

const VARIANTS = ["segmented", "default", "outline", "ghost", "pill"] as const;
const SIZES = ["segmented", "xs", "compact", "sm", "default", "lg"] as const;
const STATES = FORCED_STATES;

const PR_TABS = [
  { value: "summary", label: "Summary" },
  { value: "guide", label: "Guide" },
  { value: "timeline", label: "Timeline" },
  { value: "code", label: "Code" },
] as const;

const HISTORY_WINDOWS = ["5m", "15m", "30m", "1h"] as const;
const WEEKDAYS = [
  { value: "1", short: "M", label: "Monday" },
  { value: "2", short: "T", label: "Tuesday" },
  { value: "3", short: "W", label: "Wednesday" },
  { value: "4", short: "T", label: "Thursday" },
  { value: "5", short: "F", label: "Friday" },
  { value: "6", short: "S", label: "Saturday" },
  { value: "0", short: "S", label: "Sunday" },
] as const;

const meta = {
  title: "Components/Toggle Group",
  component: ToggleGroup,
  tags: ["autodocs"],
  args: { variant: "segmented", orientation: "horizontal", defaultValue: ["15m"] },
  argTypes: {
    variant: { control: "select", options: VARIANTS },
    size: { control: "select", options: SIZES },
    orientation: { control: "select", options: ["horizontal", "vertical"] },
    multiple: { control: "boolean" },
    disabled: { control: "boolean" },
  },
  render: (args) => (
    <ToggleGroup aria-label="Resource history period" {...args}>
      {HISTORY_WINDOWS.map((window) => (
        <ToggleGroupItem key={window} value={window}>
          {window}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  ),
} satisfies Meta<typeof ToggleGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: () => (
    <Stack gap={3}>
      {VARIANTS.map((variant) => (
        <Row key={variant} label={variant}>
          <ToggleGroup aria-label="Clone protocol" variant={variant} defaultValue={["ssh"]}>
            <ToggleGroupItem value="ssh">SSH</ToggleGroupItem>
            <ToggleGroupItem value="https">HTTPS</ToggleGroupItem>
            <ToggleGroupItem value="cli">GitHub CLI</ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup aria-label="Diff layout" variant={variant} defaultValue={["split"]}>
            <ToggleGroupItem aria-label="Stacked diff view" value="stacked">
              <Rows3Icon className="size-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem aria-label="Split diff view" value="split">
              <Columns2Icon className="size-3.5" />
            </ToggleGroupItem>
          </ToggleGroup>
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
          <ToggleGroup aria-label="Period" variant="segmented" size={size} defaultValue={["30m"]}>
            {HISTORY_WINDOWS.map((window) => (
              <ToggleGroupItem key={window} value={window}>
                {window}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <ToggleGroup aria-label="Period" variant="outline" size={size} defaultValue={["30m"]}>
            {HISTORY_WINDOWS.map((window) => (
              <ToggleGroupItem key={window} value={window}>
                {window}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
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
        <ToggleGroup aria-label="Protocol" variant={variant} defaultValue={["ssh"]}>
          <ToggleGroupItem value="ssh">SSH</ToggleGroupItem>
          <ToggleGroupItem value="https" {...forcedStateProps(state)}>
            HTTPS
          </ToggleGroupItem>
        </ToggleGroup>
      )}
    />
  ),
};

function PullRequestTabs() {
  const [value, setValue] = useState<string>("guide");
  return (
    <ToggleGroup
      size="segmented"
      variant="segmented"
      value={[value]}
      onValueChange={(next) => {
        if (next[0]) setValue(next[0]);
      }}
    >
      {PR_TABS.map((tab) => (
        <ToggleGroupItem key={tab.value} value={tab.value}>
          {tab.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

// The app has no separate Tabs component: tab strips are segmented toggle groups.
export const Tabs: Story = {
  render: () => (
    <Stack gap={4}>
      <Row label="pull request">
        <PullRequestTabs />
      </Row>
      <Row label="icon type">
        <ToggleGroup aria-label="Icon type" variant="segmented" defaultValue={["emoji"]}>
          <ToggleGroupItem value="lucide">Icons</ToggleGroupItem>
          <ToggleGroupItem value="emoji">Emoji</ToggleGroupItem>
          <ToggleGroupItem value="monogram">Monogram</ToggleGroupItem>
        </ToggleGroup>
      </Row>
      <Row label="appearance">
        <ToggleGroup aria-label="Theme appearance" variant="segmented" defaultValue={["dark"]}>
          <ToggleGroupItem value="light">
            <SunIcon />
            Light
          </ToggleGroupItem>
          <ToggleGroupItem value="dark">
            <MoonIcon />
            Dark
          </ToggleGroupItem>
        </ToggleGroup>
      </Row>
      <Row label="full width">
        <div className="w-80">
          <ToggleGroup
            aria-label="Schedule type"
            className="w-full *:flex-1"
            defaultValue={["date"]}
          >
            <ToggleGroupItem value="date">Date and time</ToggleGroupItem>
            <ToggleGroupItem value="duration">Duration</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </Row>
    </Stack>
  ),
};

export const Multiple: Story = {
  name: "Multiple (days to run)",
  render: () => (
    <ToggleGroup
      multiple
      variant="outline"
      size="sm"
      aria-label="Days to run"
      defaultValue={["1", "2", "3", "4", "5"]}
    >
      {WEEKDAYS.map((day) => (
        <ToggleGroupItem key={day.value} value={day.value} aria-label={day.label}>
          {day.short}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  ),
};

export const Vertical: Story = {
  render: () => (
    <Row>
      <ToggleGroup
        aria-label="Layout"
        variant="outline"
        orientation="vertical"
        defaultValue={["split"]}
      >
        <ToggleGroupItem value="stacked">Stacked</ToggleGroupItem>
        <ToggleGroupItem value="split">Split</ToggleGroupItem>
        <ToggleGroupItem value="unified">Unified</ToggleGroupItem>
      </ToggleGroup>
      <ToggleGroup
        aria-label="Layout"
        variant="segmented"
        orientation="vertical"
        defaultValue={["split"]}
      >
        <ToggleGroupItem value="stacked">Stacked</ToggleGroupItem>
        <ToggleGroupItem value="split">Split</ToggleGroupItem>
        <ToggleGroupItem value="unified">Unified</ToggleGroupItem>
      </ToggleGroup>
    </Row>
  ),
};

export const Disabled: Story = {
  render: () => (
    <ToggleGroup aria-label="Publish protocol" disabled defaultValue={["ssh"]}>
      <ToggleGroupItem value="ssh">SSH</ToggleGroupItem>
      <ToggleGroupItem value="https">HTTPS</ToggleGroupItem>
    </ToggleGroup>
  ),
};
