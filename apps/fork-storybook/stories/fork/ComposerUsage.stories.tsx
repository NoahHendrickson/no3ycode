import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  EnvironmentId,
  ProviderDriverKind,
  type ServerProviderUsageLimits,
  type ServerProviderUsageWindow,
} from "@t3tools/contracts";
import { collectLimitPools, type LimitAccount } from "@t3tools/shared/usageLimits";
import { useState } from "react";

import {
  ComposerLimitsTrayView,
  type ComposerLimitsTrayViewProps,
  ComposerUsageLimitsDrawer,
  ComposerUsageLimitsReadout,
} from "~/custom/ComposerUsageLimitsReadout";
import { UsageCircleMeter } from "~/custom/UsageMeter";

import { Row, Stack } from "../Specimen.tsx";
import { StoryComposer } from "../StoryComposer.tsx";

const NOW = Date.parse("2026-11-20T12:00:00.000Z");
const CHECKED_AT = "2026-11-20T12:00:00.000Z";
const inHours = (hours: number) => new Date(NOW + hours * 3_600_000).toISOString();

const limits = (windows: readonly ServerProviderUsageWindow[]): ServerProviderUsageLimits => ({
  checkedAt: CHECKED_AT,
  windows,
});

const account = (driver: string, windows: readonly ServerProviderUsageWindow[]): LimitAccount => ({
  key: `${driver}-story`,
  driver: ProviderDriverKind.make(driver),
  displayName: null,
  email: undefined,
  plan: undefined,
  accentColor: undefined,
  environments: [{ environmentId: EnvironmentId.make("env-story"), label: "Local" }],
  sourceLabel: null,
  redeem: null,
  limits: limits(windows),
});

const CODEX = [
  {
    id: "primary",
    kind: "session",
    label: "Session",
    usedPercent: 38,
    resetsAt: inHours(3),
    windowDurationMins: 300,
  },
  {
    id: "secondary",
    kind: "weekly",
    label: "Weekly",
    usedPercent: 64,
    resetsAt: inHours(70),
    windowDurationMins: 10_080,
  },
] as const satisfies readonly ServerProviderUsageWindow[];

const CLAUDE = [
  {
    id: "five_hour",
    kind: "session",
    label: "Session",
    usedPercent: 86,
    resetsAt: inHours(1),
    windowDurationMins: 300,
  },
  {
    id: "seven_day",
    kind: "weekly",
    label: "Weekly",
    usedPercent: 22,
    resetsAt: inHours(120),
    windowDurationMins: 10_080,
  },
] as const satisfies readonly ServerProviderUsageWindow[];

const POOLS = collectLimitPools([account("codex", CODEX), account("claudeAgent", CLAUDE)], NOW);

/** The composer's vessel with the drawer out above it, as the composer opens it: the ring and
    the drawer share one open state, starting open, so the ring shows pressed and closing either
    folds the drawer away. */
function Drawer(props: Omit<ComposerLimitsTrayViewProps, "now" | "onClose">) {
  const [open, setOpen] = useState(true);
  const close = () => setOpen(false);
  return (
    <div className="mt-11 w-[736px] max-w-full">
      <StoryComposer
        usageControls={
          <ComposerUsageLimitsReadout
            usageLimits={limits([CODEX[0]])}
            open={open}
            onToggle={() => setOpen((current) => !current)}
            onClose={close}
          />
        }
        topVessel={
          <ComposerUsageLimitsDrawer open={open} onClose={close}>
            <ComposerLimitsTrayView {...props} now={NOW} onClose={close} />
          </ComposerUsageLimitsDrawer>
        }
      />
    </div>
  );
}

const meta = {
  title: "Fork/Composer usage",
  component: UsageCircleMeter,
  tags: ["autodocs"],
  parameters: { surface: "composer" },
  args: { remaining: 62 },
  argTypes: { remaining: { control: { type: "range", min: 0, max: 100 } } },
} satisfies Meta<typeof UsageCircleMeter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The 12px ring with its 2px band, toned by share left: green from 50%, amber from 20%, red
    under it. No reading draws the empty track alone. */
export const Rings: Story = {
  render: () => (
    <Stack gap={3}>
      {[100, 62, 50, 35, 20, 8, 0].map((remaining) => (
        <Row key={remaining} label={`${remaining}% left`}>
          <UsageCircleMeter remaining={remaining} />
        </Row>
      ))}
      <Row label="No reading">
        <UsageCircleMeter remaining={null} />
      </Row>
    </Stack>
  ),
};

/** The usage drawer out above the composer, opened from the ring in its control row: each
    provider's windows as rings, a hairline between providers, the close button at the end. */
export const UsageDrawer: Story = {
  name: "Usage drawer",
  render: () => (
    <Stack gap={4}>
      <Drawer pools={POOLS} notices={[]} externalLinks={[]} />
      <Drawer
        pools={POOLS.slice(0, 1)}
        notices={["Cursor on Local: Usage limits are unavailable."]}
        externalLinks={[{ label: "Cursor usage", url: "https://example.com/usage" }]}
      />
      <Drawer pools={[]} notices={[]} externalLinks={[]} />
    </Stack>
  ),
};
