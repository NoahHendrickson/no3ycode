import type { Meta, StoryObj } from "@storybook/react-vite";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Popover, PopoverPopup, PopoverTrigger } from "~/components/ui/popover";

// Fixed dates keep screenshots stable from one day to the next.
const TODAY = new Date(2026, 10, 17);
const SELECTED = new Date(2026, 10, 20);

const meta = {
  title: "Components/Calendar",
  component: Calendar,
  tags: ["autodocs"],
  args: { today: TODAY, defaultMonth: TODAY, showOutsideDays: true },
  argTypes: { showOutsideDays: { control: "boolean" } },
} satisfies Meta<typeof Calendar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Single: Story = {
  render: function Render() {
    const [date, setDate] = useState(SELECTED);
    return (
      <Calendar
        mode="single"
        required
        today={TODAY}
        selected={date}
        defaultMonth={date}
        disabled={{ before: TODAY }}
        onSelect={setDate}
      />
    );
  },
};

export const Range: Story = {
  render: () => (
    <Calendar
      mode="range"
      today={TODAY}
      defaultMonth={TODAY}
      selected={{ from: new Date(2026, 10, 10), to: new Date(2026, 10, 19) }}
    />
  ),
};

export const TwoMonths: Story = {
  name: "Two months",
  render: () => (
    <Calendar
      mode="range"
      numberOfMonths={2}
      today={TODAY}
      defaultMonth={TODAY}
      selected={{ from: new Date(2026, 10, 28), to: new Date(2026, 11, 4) }}
    />
  ),
};

export const DropdownCaption: Story = {
  name: "Dropdown caption",
  render: () => (
    <Calendar
      mode="single"
      captionLayout="dropdown"
      today={TODAY}
      defaultMonth={TODAY}
      selected={SELECTED}
      startMonth={new Date(2024, 0)}
      endMonth={new Date(2028, 11)}
    />
  ),
};

export const WeekNumbers: Story = {
  name: "Week numbers, Monday start",
  render: () => (
    <Calendar
      mode="single"
      showWeekNumber
      weekStartsOn={1}
      today={TODAY}
      defaultMonth={TODAY}
      selected={SELECTED}
    />
  ),
};

export const SnoozeDateClosed: Story = {
  name: "Snooze date (closed)",
  render: () => (
    <div className="flex w-[28rem] min-w-0 flex-col gap-2">
      <Label htmlFor="story-snooze-date">Date</Label>
      <Button id="story-snooze-date" variant="outline" className="w-full justify-between">
        Nov 20, 2026
        <CalendarIcon className="size-4 text-muted-foreground" />
      </Button>
    </div>
  ),
};

export const SnoozeDateOpen: Story = {
  name: "Snooze date (open)",
  render: function Render() {
    const [date, setDate] = useState(SELECTED);
    return (
      <div className="grid h-[26rem] w-[28rem] grid-cols-2 items-start gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="story-snooze-date-open">Date</Label>
          <Popover defaultOpen>
            <PopoverTrigger
              render={
                <Button
                  id="story-snooze-date-open"
                  variant="outline"
                  className="w-full justify-between"
                />
              }
            >
              {date.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              <CalendarIcon className="size-4 text-muted-foreground" />
            </PopoverTrigger>
            <PopoverPopup align="start" aria-label="Choose snooze date" initialFocus={false}>
              <Calendar
                mode="single"
                required
                today={TODAY}
                selected={date}
                defaultMonth={date}
                disabled={{ before: TODAY }}
                onSelect={setDate}
              />
            </PopoverPopup>
          </Popover>
        </div>
        <Label className="flex min-w-0 flex-col items-stretch" htmlFor="story-snooze-time">
          Time
          <Input
            nativeInput
            id="story-snooze-time"
            className="h-9 sm:h-8"
            type="time"
            required
            defaultValue="09:00"
          />
        </Label>
      </div>
    );
  },
};
