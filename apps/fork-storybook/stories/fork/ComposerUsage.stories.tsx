import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  EnvironmentId,
  ProviderDriverKind,
  ProviderInstanceId,
  type ServerProvider,
} from "@t3tools/contracts";
import { type ComponentProps, useState } from "react";

import { Popover, PopoverPopup, PopoverTrigger } from "~/components/ui/popover";
import { UsageLimitsPooled } from "~/components/usage/UsageLimitsPooled";
import { UsageCircleMeter, UsageMeter } from "~/custom/UsageMeter";

import { Row, Stack } from "../Specimen.tsx";
import { StoryComposer } from "../StoryComposer.tsx";

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

/** The Usage view's bar, toned like the ring. */
export const Bars: Story = {
  render: () => (
    <Stack gap={3}>
      {[100, 62, 35, 8].map((remaining) => (
        <Row key={remaining} label={`${remaining}% left`}>
          <UsageMeter remaining={remaining} className="h-1.5 w-40" />
        </Row>
      ))}
      <Row label="No reading">
        <UsageMeter remaining={null} className="h-1.5 w-40" />
      </Row>
    </Stack>
  ),
};

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

function provider(
  driver: string,
  displayName: string,
  email: string,
  windows: NonNullable<ServerProvider["usageLimits"]>["windows"],
): ServerProvider {
  const checkedAt = new Date().toISOString();
  return {
    instanceId: ProviderInstanceId.make(driver),
    driver: ProviderDriverKind.make(driver),
    displayName,
    enabled: true,
    installed: true,
    version: null,
    status: "ready",
    auth: { status: "authenticated", email },
    checkedAt,
    models: [],
    slashCommands: [],
    skills: [],
    usageLimits: { checkedAt, windows },
  };
}

const PRESENTATIONS: ComponentProps<typeof UsageLimitsPooled>["presentations"] = new Map([
  [
    EnvironmentId.make("story"),
    {
      entry: { target: { label: "This Mac" } },
      serverConfig: {
        providers: [
          provider("claudeAgent", "Claude", "noey@example.com", [
            {
              id: "five_hour",
              kind: "session",
              label: "Session",
              usedPercent: 38,
              windowDurationMins: 300,
              resetsAt: hoursFromNow(2.5),
            },
            {
              id: "seven_day",
              kind: "weekly",
              label: "Weekly",
              usedPercent: 71,
              windowDurationMins: 10_080,
              resetsAt: hoursFromNow(70),
            },
          ]),
          provider("codex", "Codex", "noey@example.com", [
            {
              id: "five_hour",
              kind: "session",
              label: "Session",
              usedPercent: 86,
              windowDurationMins: 300,
              resetsAt: hoursFromNow(1),
            },
          ]),
        ],
      },
    },
  ],
]);

/** ComposerUsageLimitsReadout's ring and menu, open, with every provider's limits handed in:
    the readout itself reads them from the connected environments. */
function UsageMenu() {
  const [now] = useState(() => Date.now());
  return (
    <Popover defaultOpen>
      <PopoverTrigger
        data-fork-composer-usage-limits="true"
        data-fork-tab-trigger=""
        aria-label="Session limit: 62% left. Show usage limits"
        className="flex shrink-0 cursor-pointer items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <UsageCircleMeter remaining={62} />
      </PopoverTrigger>
      <PopoverPopup
        side="top"
        align="end"
        sideOffset={8}
        width="sm"
        padding="none"
        data-fork-tab-menu="composer"
        aria-label="Usage limits"
      >
        <div
          data-fork-usage-scroller=""
          className="max-h-[min(28rem,calc(var(--available-height)-1rem))] overflow-y-auto py-1"
        >
          <UsageLimitsPooled presentations={PRESENTATIONS} now={now} compact />
        </div>
      </PopoverPopup>
    </Popover>
  );
}

/** The ring in the composer's control row opens every provider's limits: a row per window with
    its meter and reset, providers split by dividers. */
export const Menu: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="w-[736px] max-w-full">
      <StoryComposer prompt="Ask anything" usageControls={<UsageMenu />} />
    </div>
  ),
};
