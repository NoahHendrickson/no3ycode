import type { Meta, StoryObj } from "@storybook/react-vite";
import { CalendarIcon, Settings2Icon } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Toggle, ToggleGroup } from "~/components/ui/toggle-group";

const POPUP_VARIANTS = ["default", "media"] as const;
const FOOTER_VARIANTS = ["default", "bare"] as const;

// A wide landscape gradient stands in for a screenshot attachment.
const MEDIA_IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b5bdb"/><stop offset="1" stop-color="#e64980"/></linearGradient></defs><rect width="1200" height="750" fill="url(#g)"/></svg>',
)}`;

function SnoozeFields() {
  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup aria-label="Schedule type" className="w-full *:flex-1" defaultValue={["date"]}>
        <Toggle value="date">Date and time</Toggle>
        <Toggle value="duration">Duration</Toggle>
      </ToggleGroup>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="snooze-date">Date</Label>
          <Button id="snooze-date" variant="outline" className="w-full justify-between">
            Nov 18, 2026
            <CalendarIcon className="size-4 text-muted-foreground" />
          </Button>
        </div>
        <Label className="flex min-w-0 flex-col items-stretch" htmlFor="snooze-time">
          Time
          <Input
            nativeInput
            id="snooze-time"
            className="h-9 sm:h-8"
            type="time"
            defaultValue="09:00"
          />
        </Label>
      </div>
    </div>
  );
}

function SnoozeDialogContent({
  footerVariant = "default",
}: {
  footerVariant?: (typeof FOOTER_VARIANTS)[number];
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Custom snooze</DialogTitle>
        <DialogDescription>Choose when snoozed threads return to your inbox.</DialogDescription>
      </DialogHeader>
      <DialogPanel>
        <SnoozeFields />
      </DialogPanel>
      <DialogFooter variant={footerVariant}>
        <Button type="button" variant="ghost-muted" className="sm:mr-auto">
          <Settings2Icon />
          Edit snooze options
        </Button>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <Button type="submit">Snooze</Button>
      </DialogFooter>
    </>
  );
}

const meta = {
  title: "Components/Dialog",
  // Its first example is an open modal, which inline would cover the whole docs page with.
  parameters: { docs: { story: { inline: false, iframeHeight: 520 } } },
  component: DialogPopup,
  tags: ["autodocs"],
  args: { variant: "default", showCloseButton: true, bottomStickOnMobile: true },
  argTypes: {
    variant: { control: "select", options: POPUP_VARIANTS },
    showCloseButton: { control: "boolean" },
    bottomStickOnMobile: { control: "boolean" },
  },
} satisfies Meta<typeof DialogPopup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <Dialog defaultOpen>
      <DialogTrigger render={<Button variant="outline" />}>Custom snooze…</DialogTrigger>
      <DialogPopup {...args}>
        <SnoozeDialogContent />
      </DialogPopup>
    </Dialog>
  ),
};

export const Closed: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>Custom snooze…</DialogTrigger>
      <DialogPopup>
        <SnoozeDialogContent />
      </DialogPopup>
    </Dialog>
  ),
};

export const Open: Story = {
  name: "Open (custom snooze)",
  render: () => (
    <Dialog defaultOpen>
      <DialogPopup>
        <SnoozeDialogContent />
      </DialogPopup>
    </Dialog>
  ),
};

export const BareFooter: Story = {
  name: "Footer: bare",
  render: () => (
    <Dialog defaultOpen>
      <DialogPopup>
        <SnoozeDialogContent footerVariant="bare" />
      </DialogPopup>
    </Dialog>
  ),
};

export const WithoutCloseButton: Story = {
  name: "Without close button",
  render: () => (
    <Dialog defaultOpen>
      <DialogPopup showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Add project to another machine</DialogTitle>
          <DialogDescription>
            The project is cloned on the machine you pick and appears in its sidebar.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button>Add project</Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  ),
};

export const LongContent: Story = {
  name: "Long content (scrolling panel)",
  render: () => (
    <Dialog defaultOpen>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>Release notes</DialogTitle>
          <DialogDescription>What changed in this update.</DialogDescription>
        </DialogHeader>
        <DialogPanel>
          {Array.from({ length: 14 }, (_, index) => (
            <p key={index} className="text-sm text-muted-foreground">
              Threads keep their scroll position when you switch away and back, and the sidebar no
              longer re-sorts while a turn is streaming. Item {index + 1}.
            </p>
          ))}
        </DialogPanel>
        <DialogFooter>
          <DialogClose render={<Button />}>Done</DialogClose>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  ),
};

export const Media: Story = {
  name: "Variant: media",
  render: () => (
    <Dialog defaultOpen>
      <DialogPopup variant="media" showCloseButton={false} bottomStickOnMobile={false}>
        <DialogTitle className="sr-only">screenshot.png</DialogTitle>
        <img
          src={MEDIA_IMAGE}
          alt="Attached screenshot"
          className="max-h-[80vh] max-w-full rounded-lg"
          width={1200}
          height={750}
        />
      </DialogPopup>
    </Dialog>
  ),
};
