import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChevronRightIcon } from "lucide-react";

import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Switch } from "~/components/ui/switch";

import { forcedStateProps } from "../forcedStates.ts";
import { Stack } from "../Specimen.tsx";

const LICENSES = [
  { name: "effect", license: "MIT" },
  { name: "react", license: "MIT" },
  { name: "@base-ui/react", license: "MIT" },
  { name: "xterm", license: "MIT" },
  { name: "shiki", license: "MIT" },
] as const;

function FoldedSection({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="w-[30rem] overflow-hidden rounded-xl border bg-card"
    >
      <div className="flex flex-wrap items-center gap-x-4 px-3 sm:px-4">
        <CollapsibleTrigger className="flex min-h-11 min-w-0 flex-1 basis-40 items-center gap-2 rounded-md py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
          <ChevronRightIcon
            aria-hidden
            className={`size-4 shrink-0 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none ${open ? "rotate-90" : ""}`}
          />
          <span className="text-sm font-medium">Advanced</span>
          <span className="truncate text-xs text-muted-foreground">3 settings</span>
        </CollapsibleTrigger>
      </div>
      <CollapsiblePanel>
        <div className="flex flex-col divide-y divide-border border-t">
          {[
            "Keep worktrees after archive",
            "Run setup script in background",
            "Prune stale branches",
          ].map((title, index) => (
            <div key={title} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="text-sm">{title}</span>
              <Switch defaultChecked={index !== 2} />
            </div>
          ))}
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
}

const meta = {
  title: "Components/Collapsible",
  component: Collapsible,
  tags: ["autodocs"],
  args: { defaultOpen: false },
  argTypes: {
    defaultOpen: { control: "boolean" },
    disabled: { control: "boolean" },
  },
  render: (args) => (
    <Collapsible {...args} className="w-80">
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring data-panel-open:[&>svg]:rotate-90">
        <ChevronRightIcon className="size-4 text-muted-foreground transition-transform" />
        Open source licenses
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <ul className="flex flex-col gap-1 px-2 pt-2 pl-8 text-sm text-muted-foreground">
          {LICENSES.map((item) => (
            <li key={item.name} className="flex justify-between">
              <span>{item.name}</span>
              <span>{item.license}</span>
            </li>
          ))}
        </ul>
      </CollapsiblePanel>
    </Collapsible>
  ),
} satisfies Meta<typeof Collapsible>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Open: Story = {
  args: { defaultOpen: true },
};

export const States: Story = {
  render: () => (
    <Stack gap={3}>
      {(["default", "hover", "focus", "disabled"] as const).map((state) => (
        <div key={state} className="flex items-center gap-6">
          <span className="w-28 shrink-0 font-mono text-[11px] text-muted-foreground">{state}</span>
          <Collapsible className="w-72" disabled={state === "disabled"}>
            <CollapsibleTrigger
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-64"
              {...(state === "disabled" ? {} : forcedStateProps(state))}
            >
              <ChevronRightIcon className="size-4 text-muted-foreground" />
              Open source licenses
            </CollapsibleTrigger>
          </Collapsible>
        </div>
      ))}
    </Stack>
  ),
};

export const SettingsSection: Story = {
  name: "Folded settings section",
  parameters: { surface: "page" },
  render: () => (
    <Stack gap={3}>
      <FoldedSection />
      <FoldedSection defaultOpen />
    </Stack>
  ),
};

export const WithoutAnimation: Story = {
  name: "Panel without animation",
  render: () => (
    <Collapsible defaultOpen className="w-80">
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring data-panel-open:[&>svg]:rotate-90">
        <ChevronRightIcon className="size-4 text-muted-foreground" />
        Show raw output
      </CollapsibleTrigger>
      <CollapsiblePanel animate={false}>
        <pre className="mt-2 rounded-lg bg-muted p-3 font-mono text-xs text-muted-foreground">
          {"$ vp run typecheck\n✓ apps/web  (1.8s)\n✓ apps/server  (2.4s)"}
        </pre>
      </CollapsiblePanel>
    </Collapsible>
  ),
};
