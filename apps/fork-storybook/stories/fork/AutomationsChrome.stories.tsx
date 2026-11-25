import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { ScheduledRelativeLabel } from "~/custom/scheduled/ScheduledRelativeLabel";
import { ScheduledCard, ScheduledSectionLabel } from "~/custom/scheduled/scheduledPageChrome";
import { ScheduledTriggerTabs } from "~/custom/scheduled/ScheduledTriggerTabs";

import { Row, Stack } from "../Specimen.tsx";

const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

/** A section of the Automations page: its label over a card. */
function Section() {
  return (
    <div className="flex w-[640px] max-w-full flex-col gap-2">
      <ScheduledSectionLabel>Upcoming</ScheduledSectionLabel>
      <ScheduledCard>
        <div className="flex flex-col divide-y divide-border/60 text-sm">
          {[
            ["Nightly dependency bumps", 45],
            ["Weekly upstream sync", 60 * 30],
            ["Triage new issues", 3 * 24 * 60],
          ].map(([title, minutes]) => (
            <div key={title} className="flex items-center justify-between px-4 py-3">
              <span>{title}</span>
              <span className="text-muted-foreground">
                <ScheduledRelativeLabel value={minutesFromNow(Number(minutes))} />
              </span>
            </div>
          ))}
        </div>
      </ScheduledCard>
    </div>
  );
}

const meta = {
  title: "Fork/Automations chrome",
  component: Section,
  tags: ["autodocs"],
  parameters: { surface: "page" },
} satisfies Meta<typeof Section>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The page's one card surface and section label, which the list, the editor and the run
    history share. */
export const Playground: Story = {};

/** When a run happens, in words: past runs as upstream's relative time, upcoming ones ahead. */
export const RelativeLabels: Story = {
  name: "Relative labels",
  render: () => (
    <Stack gap={2}>
      {[
        ["Not scheduled", null],
        ["An hour ago", minutesFromNow(-60)],
        ["In a minute", minutesFromNow(1)],
        ["In 45 minutes", minutesFromNow(45)],
        ["In 5 hours", minutesFromNow(5 * 60)],
        ["In 3 days", minutesFromNow(3 * 24 * 60)],
      ].map(([label, value]) => (
        <Row key={label} label={label!}>
          <span className="text-sm">
            <ScheduledRelativeLabel value={value ?? null} />
          </span>
        </Row>
      ))}
    </Stack>
  ),
};

/** The editor's trigger picker; Once is offered only where the task can run once. */
export const TriggerTabs: Story = {
  name: "Trigger tabs",
  render: function Render() {
    const [value, setValue] = useState<ReadonlyArray<string>>(["fixed"]);
    return (
      <Stack gap={3}>
        <ScheduledTriggerTabs value={[...value]} onValueChange={setValue} offersOnce />
        <ScheduledTriggerTabs value={[...value]} onValueChange={setValue} offersOnce={false} />
      </Stack>
    );
  },
};
