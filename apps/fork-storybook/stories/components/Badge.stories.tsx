import type { CSSProperties } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CheckIcon, CircleAlertIcon, ClockIcon, MicIcon } from "lucide-react";

import { PullRequestGlyph } from "~/components/pullRequest/pullRequestIcons";

import { Badge } from "~/components/ui/badge";

import { FORCED_STATES, forcedStateProps } from "../forcedStates.ts";
import { Matrix, Row, Stack } from "../Specimen.tsx";

const VARIANTS = [
  "default",
  "secondary",
  "outline",
  "destructive",
  "error",
  "info",
  "success",
  "warning",
  "label",
] as const;
const SIZES = ["sm", "default", "lg", "control"] as const;
const STATES = FORCED_STATES;

const LABELS = [
  { name: "bug", color: "#d73a4a" },
  { name: "enhancement", color: "#a2eeef" },
  { name: "needs review", color: "#fbca04" },
  { name: "good first issue", color: "#7057ff" },
  { name: "dependencies", color: "#0366d6" },
] as const;

const labelStyle = (color: string) => ({ "--label": color }) as CSSProperties;

const meta = {
  title: "Components/Badge",
  component: Badge,
  tags: ["autodocs"],
  args: { children: "Badge", variant: "default", size: "default" },
  argTypes: {
    variant: { control: "select", options: VARIANTS },
    size: { control: "select", options: SIZES },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: () => (
    <Stack gap={3}>
      {VARIANTS.map((variant) => (
        <Row key={variant} label={variant}>
          <Badge variant={variant} style={variant === "label" ? labelStyle("#7057ff") : undefined}>
            Badge
          </Badge>
          <Badge variant={variant} style={variant === "label" ? labelStyle("#7057ff") : undefined}>
            <CheckIcon />
            With icon
          </Badge>
          <Badge
            variant={variant}
            size="sm"
            style={variant === "label" ? labelStyle("#7057ff") : undefined}
          >
            Small
          </Badge>
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
          <Badge size={size}>Default</Badge>
          <Badge size={size} variant="outline">
            <ClockIcon />
            Outline
          </Badge>
          <Badge size={size} variant="success">
            Linked
          </Badge>
          <Badge size={size} variant="secondary">
            3
          </Badge>
        </Row>
      ))}
    </Stack>
  ),
};

// Only a badge rendered as a button or link takes hover and focus styles.
export const States: Story = {
  render: () => (
    <Matrix
      rows={VARIANTS}
      columns={STATES}
      cell={(variant, state) => (
        <Badge
          variant={variant}
          render={<button type="button" />}
          style={variant === "label" ? labelStyle("#0366d6") : undefined}
          {...forcedStateProps(state)}
        >
          Badge
        </Badge>
      )}
    />
  ),
};

export const RunStatus: Story = {
  name: "Run status",
  render: () => (
    <Row label="scheduled runs">
      <Badge variant="success">Completed</Badge>
      <Badge variant="error">Failed</Badge>
      <Badge variant="warning">Waiting</Badge>
      <Badge variant="info">Running</Badge>
      <Badge variant="info">Queued</Badge>
      <Badge variant="secondary">Cancelled</Badge>
      <Badge variant="secondary">Rolled back</Badge>
    </Row>
  ),
};

export const SettingsRows: Story = {
  name: "In settings rows",
  parameters: { surface: "page" },
  render: () => (
    <div className="flex w-[30rem] flex-col divide-y divide-border rounded-xl border bg-card">
      {[
        {
          title: "MacBook Pro",
          badge: (
            <Badge variant="success" size="sm">
              Linked
            </Badge>
          ),
        },
        {
          title: "Studio",
          badge: (
            <Badge variant="outline" size="sm">
              T3 Connect
            </Badge>
          ),
        },
        {
          title: "Build box",
          badge: (
            <Badge variant="outline" size="sm">
              Not connected
            </Badge>
          ),
        },
        {
          title: "GitLab",
          badge: (
            <Badge variant="warning" size="sm">
              Coming Soon
            </Badge>
          ),
        },
        { title: "Codex", badge: <Badge>Default</Badge> },
      ].map((row) => (
        <div key={row.title} className="flex items-center gap-2 px-4 py-3 text-sm">
          <span className="font-medium">{row.title}</span>
          {row.badge}
        </div>
      ))}
    </div>
  ),
};

export const PullRequestLabels: Story = {
  name: "Pull request labels",
  render: () => (
    <Stack gap={3}>
      <Row label="label colours">
        {LABELS.map((label) => (
          <Badge
            key={label.name}
            size="sm"
            variant="label"
            className="min-w-0 max-w-40 shrink justify-start"
            style={labelStyle(label.color)}
          >
            <span className="truncate">{label.name}</span>
          </Badge>
        ))}
      </Row>
      <Row label="no colour">
        <Badge size="sm" variant="secondary" className="min-w-0 max-w-40 shrink justify-start">
          <span className="truncate">wontfix</span>
        </Badge>
      </Row>
      <Row label="truncated">
        <Badge
          size="sm"
          variant="label"
          className="min-w-0 max-w-40 shrink justify-start"
          style={labelStyle("#0e8a16")}
        >
          <span className="truncate">area: orchestration and event sourcing</span>
        </Badge>
      </Row>
    </Stack>
  ),
};

export const WithIcons: Story = {
  name: "With icons",
  render: () => (
    <Row>
      <Badge variant="outline">
        <MicIcon />
        Microphone
      </Badge>
      <Badge variant="error">
        <CircleAlertIcon />
        Auth failed
      </Badge>
      <Badge variant="info" size="sm">
        <PullRequestGlyph.pullRequest />
        Open
      </Badge>
      <Badge variant="outline" size="sm">
        Unavailable
      </Badge>
    </Row>
  ),
};
