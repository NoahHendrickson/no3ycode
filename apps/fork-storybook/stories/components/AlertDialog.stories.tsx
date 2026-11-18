import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";

const FOOTER_VARIANTS = ["default", "bare"] as const;
const CONFIRM_VARIANTS = ["default", "destructive"] as const;

type ConfirmProps = {
  title: string;
  description?: string;
  footer?: (typeof FOOTER_VARIANTS)[number];
  confirm?: (typeof CONFIRM_VARIANTS)[number];
};

// ConfirmDialogHost's layout: the question is the title, the rest of the message the description.
function Confirm({ title, description, footer = "default", confirm = "default" }: ConfirmProps) {
  return (
    <AlertDialogPopup>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        {description ? (
          <AlertDialogDescription className="whitespace-pre-line">
            {description}
          </AlertDialogDescription>
        ) : null}
      </AlertDialogHeader>
      <AlertDialogFooter variant={footer}>
        <AlertDialogClose render={<Button variant="outline" />}>Cancel</AlertDialogClose>
        {confirm === "default" ? (
          <AlertDialogAction>Confirm</AlertDialogAction>
        ) : (
          <Button variant={confirm}>Confirm</Button>
        )}
      </AlertDialogFooter>
    </AlertDialogPopup>
  );
}

const meta = {
  title: "Components/Alert Dialog",
  // Its first example is an open modal, which inline would cover the whole docs page with.
  parameters: { docs: { story: { inline: false, iframeHeight: 520 } } },
  component: AlertDialogPopup,
  tags: ["autodocs"],
} satisfies Meta<typeof AlertDialogPopup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: StoryObj<ConfirmProps> = {
  args: {
    title: "Restore default settings?",
    description: "This will reset: Theme, Font size, Timestamp format.",
    footer: "default",
    confirm: "default",
  },
  argTypes: {
    footer: { control: "select", options: FOOTER_VARIANTS },
    confirm: { control: "select", options: CONFIRM_VARIANTS },
  },
  render: (args) => (
    <AlertDialog defaultOpen>
      <Confirm {...args} />
    </AlertDialog>
  ),
};

// The module exports no trigger: the app opens alert dialogs from state, as ConfirmDialogHost does.
function DeleteThreadButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="destructive-outline" onClick={() => setOpen(true)}>
        Delete thread
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <Confirm title='Delete thread "Fix flaky toast test"?' confirm="destructive" />
      </AlertDialog>
    </>
  );
}

export const Closed: Story = {
  render: () => <DeleteThreadButton />,
};

export const Open: Story = {
  name: "Open (destructive)",
  render: () => (
    <AlertDialog defaultOpen>
      <Confirm
        title="Remove MacBook Pro from this device?"
        description="This forgets its pairing, credentials, and cached threads here. Switch it off instead to keep it saved."
        confirm="destructive"
      />
    </AlertDialog>
  ),
};

export const Default: Story = {
  name: "Open (default confirm)",
  render: () => (
    <AlertDialog defaultOpen>
      <Confirm
        title="Restore default settings?"
        description="This will reset: Theme, Font size, Timestamp format."
      />
    </AlertDialog>
  ),
};

export const TitleOnly: Story = {
  name: "Title only",
  render: () => (
    <AlertDialog defaultOpen>
      <Confirm title='Delete thread "Fix flaky toast test"?' confirm="destructive" />
    </AlertDialog>
  ),
};

export const BareFooter: Story = {
  name: "Footer: bare",
  render: () => (
    <AlertDialog defaultOpen>
      <Confirm
        title="Send SIGKILL to process 48211?"
        description="This cannot be handled by the process."
        footer="bare"
        confirm="destructive"
      />
    </AlertDialog>
  ),
};
