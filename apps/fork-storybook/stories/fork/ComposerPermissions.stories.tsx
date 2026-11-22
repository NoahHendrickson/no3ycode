import type { Meta, StoryObj } from "@storybook/react-vite";
import type { RuntimeMode } from "@t3tools/contracts";
import { type CSSProperties, useState } from "react";

import {
  ComposerFooterModeControls,
  ComposerPermissionsSection,
  type RuntimeModeOption,
} from "~/components/chat/ComposerFooterControls";
import { runtimeModeConfig, runtimeModeOptions } from "~/components/chat/runtimeModeConfig";
import { Button } from "~/components/ui/button";
import { Menu, MenuPopup, MenuTrigger } from "~/components/ui/menu";
import { ComposerShell } from "~/custom/ComposerShell";

import { Row, Stack } from "../Specimen.tsx";

const OPTIONS: ReadonlyArray<RuntimeModeOption> = runtimeModeOptions.map((mode) => ({
  mode,
  ...runtimeModeConfig[mode],
}));

// A managed policy that rules Full access out, as resolveRuntimeModeOptions marks it.
const MANAGED_OPTIONS: ReadonlyArray<RuntimeModeOption> = OPTIONS.map((option) =>
  option.mode === "full-access"
    ? { ...option, disabledReason: "Your organization does not allow Full access." }
    : option,
);

// The canvas centres; a popup opens below its trigger.
const TOP: CSSProperties = { alignSelf: "flex-start", paddingTop: 24 };

/** The chip in the composer's control row, where the theme makes it icon-only. */
function Chip({ mode }: { mode: RuntimeMode }) {
  const [runtimeMode, setRuntimeMode] = useState(mode);
  return (
    <div className="w-72">
      <ComposerShell
        approvalPending={false}
        collapsedMobile={false}
        mobilePendingActionsVisible={false}
        modelControls={null}
        readoutControls={null}
        modeControls={
          <ComposerFooterModeControls
            runtimeMode={runtimeMode}
            runtimeModeOptions={OPTIONS}
            emphasized
            onRuntimeModeChange={setRuntimeMode}
          />
        }
      />
    </div>
  );
}

/** The chip's menu, open: the fork's menu tab strip, and the shown mode named under it. */
function PermissionsMenu({
  mode,
  options = OPTIONS,
}: {
  mode: RuntimeMode;
  options?: ReadonlyArray<RuntimeModeOption>;
}) {
  const [runtimeMode, setRuntimeMode] = useState(mode);
  return (
    <Menu defaultOpen modal={false}>
      <MenuTrigger render={<Button variant="outline" size="sm" />}>Permissions</MenuTrigger>
      <MenuPopup align="start" data-fork-glass-selection>
        <ComposerPermissionsSection
          runtimeMode={runtimeMode}
          runtimeModeOptions={options}
          onRuntimeModeChange={setRuntimeMode}
        />
      </MenuPopup>
    </Menu>
  );
}

const meta = {
  title: "Fork/Composer permissions",
  component: ComposerPermissionsSection,
  tags: ["autodocs"],
  parameters: { surface: "composer" },
  args: {
    runtimeMode: "approval-required",
    runtimeModeOptions: OPTIONS,
    onRuntimeModeChange: () => {},
  },
  argTypes: {
    runtimeMode: { control: "select", options: runtimeModeOptions },
  },
} satisfies Meta<typeof ComposerPermissionsSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  parameters: { surface: "stage" },
  render: (args) => (
    <div style={TOP}>
      <PermissionsMenu key={args.runtimeMode} mode={args.runtimeMode} />
    </div>
  ),
};

/** The chip for each mode. Full access draws the filled shield; the label stays for screen
    readers and the tooltip. */
export const Chips: Story = {
  render: () => (
    <Stack gap={3}>
      {OPTIONS.map((option) => (
        <Row key={option.mode} label={option.label}>
          <Chip mode={option.mode} />
        </Row>
      ))}
    </Stack>
  ),
};

/** The strip with each mode picked, and with Full access ruled out by a managed policy. */
export const Menus: Story = {
  parameters: { surface: "stage" },
  render: () => (
    <div
      style={{
        ...TOP,
        display: "grid",
        gridTemplateColumns: "repeat(3, 320px)",
        rowGap: 200,
        alignItems: "start",
        justifyItems: "start",
      }}
    >
      {OPTIONS.map((option) => (
        <PermissionsMenu key={option.mode} mode={option.mode} />
      ))}
      <PermissionsMenu mode="approval-required" options={MANAGED_OPTIONS} />
    </div>
  ),
};
