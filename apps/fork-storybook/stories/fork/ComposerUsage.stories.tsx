import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  EnvironmentId,
  ProviderDriverKind,
  type ServerProviderUsageLimits,
  type ServerProviderUsageWindow,
} from "@t3tools/contracts";
import { collectLimitPools, type LimitAccount } from "@t3tools/shared/usageLimits";

import {
  ComposerLimitsTrayView,
  useComposerUsageDrawer,
} from "~/custom/ComposerUsageLimitsReadout";
import { ComposerShell } from "~/custom/ComposerShell";
import { UsageCircleMeter } from "~/custom/UsageMeter";

import { Row, Stack } from "../Specimen.tsx";

const NOW = Date.parse("2026-11-20T12:00:00.000Z");
const CHECKED_AT = "2026-11-20T12:00:00.000Z";
const inHours = (hours: number) => new Date(NOW + hours * 3_600_000).toISOString();

const limits = (windows: ServerProviderUsageWindow[]): ServerProviderUsageLimits => ({
  checkedAt: CHECKED_AT,
  windows,
});

const account = (driver: string, windows: ServerProviderUsageWindow[]): LimitAccount => ({
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
] as const satisfies ServerProviderUsageWindow[];

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
] as const satisfies ServerProviderUsageWindow[];

const POOLS = collectLimitPools(
  [account("codex", [...CODEX]), account("claudeAgent", [...CLAUDE])],
  NOW,
);

const noop = () => {};

/** The composer's quota trigger: the session window's ring, as the control row shows it. */
function Trigger({ usedPercent }: { usedPercent: number }) {
  const { readout } = useComposerUsageDrawer({
    usageLimits: limits([{ ...CODEX[0], usedPercent }]),
    enabled: true,
  });
  return readout;
}

/** The composer's vessel with the drawer out above it, as the composer opens it. The stamp is
    the one the drawer's panel carries, so the theme gives it the drawer's fill and edge. */
function Drawer(props: Omit<Parameters<typeof ComposerLimitsTrayView>[0], "now" | "onClose">) {
  return (
    <div className="mt-11 w-[736px] max-w-full">
      <ComposerShell
        approvalPending={false}
        collapsedMobile={false}
        mobilePendingActionsVisible={false}
        modelControls={null}
        modeControls={null}
        readoutControls={null}
        usageControls={<Trigger usedPercent={CODEX[0].usedPercent} />}
        topVessel={
          <div data-fork-composer-usage-drawer="true" className="pointer-events-auto">
            <ComposerLimitsTrayView {...props} now={NOW} onClose={noop} />
          </div>
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
        externalLinks={[{ label: "Cursor usage", url: "https://cursor.com/dashboard" }]}
      />
      <Drawer pools={[]} notices={[]} externalLinks={[]} />
    </Stack>
  ),
};
