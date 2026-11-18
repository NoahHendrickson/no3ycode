import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { SettingsGroup } from "~/components/settings/SettingsGroup";
import { SettingsRow } from "~/components/settings/settingsLayout";
import { DraftInput, type DraftInputProps } from "~/components/ui/draft-input";

import { type ForcedState, forcedStateProps } from "../forcedStates.ts";
import { Matrix, Row, Stack } from "../Specimen.tsx";

const SIZES = ["sm", "compact", "default", "lg"] as const;
const FONTS = ["default", "mono"] as const;
const STATES = [
  "default",
  "hover",
  "active",
  "focus",
  "disabled",
] as const satisfies ReadonlyArray<ForcedState>;
const CONTENT = ["empty", "saved", "mixed"] as const;

// Commits land in local state, the way a settings update would echo back, so the saved value and
// the commit count show that typing alone never commits.
function Committing(props: Omit<DraftInputProps, "value" | "onCommit"> & { initial: string }) {
  const { initial, ...rest } = props;
  const [value, setValue] = useState(initial);
  const [commits, setCommits] = useState(0);
  return (
    <div className="space-y-1.5">
      <DraftInput
        {...rest}
        value={value}
        onCommit={(next) => {
          setValue(next);
          setCommits((count) => count + 1);
        }}
      />
      <p className="font-mono text-[11px] text-muted-foreground">
        saved: {JSON.stringify(value)} · commits: {commits}
      </p>
    </div>
  );
}

const meta = {
  title: "Components/Draft Input",
  component: DraftInput,
  tags: ["autodocs"],
  args: {
    value: "~/Developer",
    onCommit: () => undefined,
    size: "sm",
    font: "default",
    placeholder: "~/",
    spellCheck: false,
  },
  argTypes: {
    size: { control: "select", options: SIZES },
    font: { control: "select", options: FONTS },
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof DraftInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: ({ value, onCommit: _onCommit, ...args }) => (
    <div className="w-72">
      <Committing {...args} initial={value} aria-label="Add project base directory" />
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <Stack gap={3}>
      {SIZES.map((size) => (
        <Row key={size} label={size}>
          <div className="w-72">
            <DraftInput
              size={size}
              value="~/Developer"
              onCommit={() => undefined}
              aria-label={size}
            />
          </div>
        </Row>
      ))}
      <Row label="font=mono">
        <div className="w-72">
          <DraftInput
            size="sm"
            font="mono"
            value="/opt/homebrew/bin/claude"
            onCommit={() => undefined}
            aria-label="Binary path"
          />
        </div>
      </Row>
    </Stack>
  ),
};

export const States: Story = {
  render: () => (
    <Matrix
      rows={CONTENT}
      columns={STATES}
      cell={(content, state) => (
        <div className="w-36">
          <DraftInput
            size="sm"
            value={content === "saved" ? "~/Developer" : ""}
            placeholder={content === "mixed" ? "Mixed" : "~/"}
            onCommit={() => undefined}
            aria-label={`${content} ${state}`}
            {...forcedStateProps(state)}
          />
        </div>
      )}
    />
  ),
};

export const SettingsControl: Story = {
  name: "Settings control",
  parameters: { surface: "page" },
  render: () => (
    <div className="w-[40rem]">
      <SettingsGroup>
        <SettingsRow
          title="Add project starts in"
          description='Leave empty to use "~/" when the Add Project browser opens.'
          control={
            <Committing
              size="sm"
              className="w-full sm:w-72"
              initial=""
              placeholder="~/"
              spellCheck={false}
              aria-label="Add project base directory"
            />
          }
        />
      </SettingsGroup>
    </div>
  ),
};
