import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileDiffIcon, GitBranchIcon, TerminalIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetPopup,
  SheetTitle,
} from "~/components/ui/sheet";

const SIDES = ["right", "left", "top", "bottom"] as const;
const VARIANTS = ["default", "inset"] as const;

function WorkspaceBody() {
  const rows = [
    { Icon: FileDiffIcon, label: "Diff", detail: "12 files changed" },
    { Icon: TerminalIcon, label: "Terminal", detail: "bun run dev" },
    { Icon: GitBranchIcon, label: "Branch", detail: "t3/sheet-stories" },
  ];
  return (
    <>
      <SheetHeader>
        <SheetTitle>Workspace panel</SheetTitle>
        <SheetDescription>Diff, terminal and branch for the current thread.</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-1 px-6 pb-6">
        {rows.map(({ Icon, label, detail }) => (
          <div key={label} className="flex items-center gap-3 rounded-md px-2 py-2 text-sm">
            <Icon className="size-4 text-muted-foreground" />
            <span className="font-medium">{label}</span>
            <span className="ms-auto truncate text-muted-foreground">{detail}</span>
          </div>
        ))}
      </div>
    </>
  );
}

const meta = {
  title: "Components/Sheet",
  // Its first example is an open modal, which inline would cover the whole docs page with.
  parameters: { docs: { story: { inline: false, iframeHeight: 520 } } },
  component: SheetPopup,
  tags: ["autodocs"],
  args: { side: "right", variant: "default", showCloseButton: true },
  argTypes: {
    side: { control: "select", options: SIDES },
    variant: { control: "select", options: VARIANTS },
    showCloseButton: { control: "boolean" },
  },
} satisfies Meta<typeof SheetPopup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <Sheet defaultOpen>
      <SheetPopup {...args}>
        <WorkspaceBody />
      </SheetPopup>
    </Sheet>
  ),
};

// The module exports no trigger: the app opens sheets from state, as RightPanelSheet does.
function WorkspacePanelButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open workspace panel
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetPopup>
          <WorkspaceBody />
        </SheetPopup>
      </Sheet>
    </>
  );
}

export const Closed: Story = {
  render: () => <WorkspacePanelButton />,
};

export const Right: Story = {
  name: "Open: right",
  render: () => (
    <Sheet defaultOpen>
      <SheetPopup side="right">
        <WorkspaceBody />
      </SheetPopup>
    </Sheet>
  ),
};

export const Left: Story = {
  name: "Open: left",
  render: () => (
    <Sheet defaultOpen>
      <SheetPopup side="left">
        <WorkspaceBody />
      </SheetPopup>
    </Sheet>
  ),
};

export const Top: Story = {
  name: "Open: top",
  render: () => (
    <Sheet defaultOpen>
      <SheetPopup side="top">
        <WorkspaceBody />
      </SheetPopup>
    </Sheet>
  ),
};

export const Bottom: Story = {
  name: "Open: bottom",
  render: () => (
    <Sheet defaultOpen>
      <SheetPopup side="bottom">
        <WorkspaceBody />
      </SheetPopup>
    </Sheet>
  ),
};

export const Inset: Story = {
  name: "Variant: inset",
  render: () => (
    <Sheet defaultOpen>
      <SheetPopup side="right" variant="inset">
        <WorkspaceBody />
      </SheetPopup>
    </Sheet>
  ),
};

export const RightPanel: Story = {
  name: "Right panel (app usage)",
  render: () => (
    <Sheet defaultOpen>
      <SheetPopup
        side="right"
        showCloseButton={false}
        className="w-[min(42vw,28rem)] min-w-80 max-w-[28rem] max-[760px]:w-[min(88vw,24rem)] max-[760px]:min-w-0"
      >
        <WorkspaceBody />
      </SheetPopup>
    </Sheet>
  ),
};
