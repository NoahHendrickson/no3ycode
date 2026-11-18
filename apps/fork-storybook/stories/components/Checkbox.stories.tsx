import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Checkbox, CheckboxMark } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";

import { FORCED_STATES, forcedStateProps } from "../forcedStates.ts";
import { Matrix, Row, Stack } from "../Specimen.tsx";

const VARIANTS = ["default", "contrast"] as const;
const STATES = FORCED_STATES;
const VALUES = ["unchecked", "checked", "indeterminate", "invalid"] as const;

const PERMISSIONS = [
  {
    title: "View environment",
    description: "Read threads, status, checkpoints, and configuration.",
  },
  { title: "Operate tasks", description: "Start, update, and stop tasks." },
  {
    title: "Change environment settings",
    description: "Edit environment preferences and keybindings.",
  },
  {
    title: "Manage providers",
    description: "Configure, install, sign in to, and update providers and usage sources.",
  },
] as const;

const FILES = [
  "apps/web/src/components/ui/checkbox.tsx",
  "apps/web/src/components/settings/SettingsPanels.tsx",
  "apps/server/src/orchestration-v2/Orchestrator.ts",
  "packages/contracts/src/settings.ts",
] as const;

const meta = {
  title: "Components/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  args: { variant: "default", defaultChecked: true },
  argTypes: {
    variant: { control: "select", options: VARIANTS },
    disabled: { control: "boolean" },
    indeterminate: { control: "boolean" },
    "aria-invalid": { control: "boolean" },
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: () => (
    <Stack gap={3}>
      {VARIANTS.map((variant) => (
        <Row key={variant} label={variant}>
          <Checkbox variant={variant} aria-label="Unchecked" />
          <Checkbox variant={variant} defaultChecked aria-label="Checked" />
          <Checkbox variant={variant} indeterminate aria-label="Indeterminate" />
        </Row>
      ))}
      <Row label="CheckboxMark">
        <CheckboxMark checked={false} />
        <CheckboxMark checked />
        <CheckboxMark checked={false} variant="contrast" />
        <CheckboxMark checked variant="contrast" />
      </Row>
    </Stack>
  ),
};

export const States: Story = {
  render: () => (
    <Matrix
      rows={VALUES}
      columns={STATES}
      cell={(value, state) => (
        <Checkbox
          {...forcedStateProps(state)}
          aria-label={`${value} ${state}`}
          defaultChecked={value === "checked"}
          indeterminate={value === "indeterminate"}
          aria-invalid={value === "invalid" ? true : undefined}
        />
      )}
    />
  ),
};

export const PermissionList: Story = {
  name: "Permission list",
  render: () => (
    <div className="w-96 space-y-2">
      <div className="divide-y divide-border/60 rounded-lg border border-input bg-muted/25">
        {PERMISSIONS.map(({ title, description }, index) => (
          <label
            key={title}
            className="flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40"
          >
            <Checkbox className="mt-0.5" defaultChecked={index < 2} />
            <span className="min-w-0">
              <span className="block text-xs font-medium text-foreground">{title}</span>
              <span className="block text-xs leading-snug text-muted-foreground">
                {description}
              </span>
            </span>
          </label>
        ))}
      </div>
      <p className="text-xs text-destructive">Select at least one permission.</p>
    </div>
  ),
};

function FileSelection() {
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(() => new Set([FILES[2]]));
  const allSelected = excluded.size === 0;
  const noneSelected = excluded.size === FILES.length;
  return (
    <div className="w-[26rem] space-y-1 text-xs">
      <div className="flex items-center gap-2">
        <Checkbox
          aria-label="Include all files"
          checked={allSelected}
          indeterminate={!allSelected && !noneSelected}
          onCheckedChange={() => setExcluded(allSelected ? new Set(FILES) : new Set())}
        />
        <span className="text-muted-foreground">Files</span>
      </div>
      {FILES.map((path) => (
        <div
          key={path}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1 font-mono hover:bg-accent/50"
        >
          <Checkbox
            aria-label={path}
            checked={!excluded.has(path)}
            onCheckedChange={() =>
              setExcluded((previous) => {
                const next = new Set(previous);
                if (next.has(path)) next.delete(path);
                else next.add(path);
                return next;
              })
            }
          />
          <span className="truncate">{path}</span>
        </div>
      ))}
    </div>
  );
}

export const FileList: Story = {
  name: "Commit file list",
  render: () => <FileSelection />,
};

export const WithLabel: Story = {
  name: "With label",
  render: () => (
    <div className="flex flex-col gap-3">
      <Label className="flex items-center gap-2">
        <Checkbox defaultChecked />
        t3code
      </Label>
      <Label className="flex items-center gap-2">
        <Checkbox />
        no3ycode
      </Label>
      <Label className="flex items-center gap-2">
        <Checkbox disabled />
        marketing-site
      </Label>
    </div>
  ),
};
