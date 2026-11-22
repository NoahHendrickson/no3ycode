import type { Meta, StoryObj } from "@storybook/react-vite";
import type { RuntimeMode } from "@t3tools/contracts";
import { type ComponentProps, useState } from "react";
import { useArgs } from "storybook/preview-api";

import {
  ComposerFooterModeControls,
  ComposerPermissionsSection,
} from "~/components/chat/ComposerFooterControls";
import { composerFloatingLayerProps } from "~/components/chat/composerEventScope";
import { resolveRuntimeModeOptions, runtimeModeOptions } from "~/components/chat/runtimeModeConfig";
import { Button } from "~/components/ui/button";
import { Menu, MenuPopup, MenuTrigger } from "~/components/ui/menu";

import { POPUP_ANCHOR, Row, Stack } from "../Specimen.tsx";
import { StoryComposer } from "../StoryComposer.tsx";

type SectionProps = ComponentProps<typeof ComposerPermissionsSection>;

const OPTIONS = resolveRuntimeModeOptions(runtimeModeOptions, undefined);
const MANAGED_OPTIONS = resolveRuntimeModeOptions(runtimeModeOptions, {
  organization: "Acme",
  lockedSettings: [],
  limits: { maxRuntimeMode: "auto-accept-edits" },
});

/** The chip in the composer's control row, where the theme makes it icon-only. */
function Chip({ mode }: { mode: RuntimeMode }) {
  const [runtimeMode, setRuntimeMode] = useState(mode);
  return (
    <div className="w-72">
      <StoryComposer
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

/** The chip's menu, open, with the composer popup's marker: the fork's menu tab strip, and the
    shown mode named under it. */
function PermissionsMenu(props: SectionProps) {
  return (
    <Menu defaultOpen modal={false}>
      <MenuTrigger render={<Button variant="outline" size="sm" />}>Permissions</MenuTrigger>
      <MenuPopup align="start" {...composerFloatingLayerProps} data-fork-glass-selection>
        <ComposerPermissionsSection {...props} />
      </MenuPopup>
    </Menu>
  );
}

function PickedMenu({
  mode,
  options = OPTIONS,
}: {
  mode: RuntimeMode;
  options?: SectionProps["runtimeModeOptions"];
}) {
  const [runtimeMode, setRuntimeMode] = useState(mode);
  return (
    <PermissionsMenu
      runtimeMode={runtimeMode}
      runtimeModeOptions={options}
      onRuntimeModeChange={setRuntimeMode}
    />
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

/** Picking a mode moves the `runtimeMode` control; the options control feeds the menu. */
export const Playground: Story = {
  parameters: { surface: "stage" },
  render: function Render(args) {
    const [, updateArgs] = useArgs<SectionProps>();
    return (
      <div style={POPUP_ANCHOR}>
        <PermissionsMenu
          runtimeMode={args.runtimeMode}
          runtimeModeOptions={args.runtimeModeOptions}
          onRuntimeModeChange={(runtimeMode) => updateArgs({ runtimeMode })}
        />
      </div>
    );
  },
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

/** The strip with each mode picked, and with a managed policy capping threads at Auto-accept
    edits, which rules Auto and Full access out. */
export const Menus: Story = {
  parameters: { surface: "stage" },
  render: () => (
    <div
      style={{
        ...POPUP_ANCHOR,
        display: "grid",
        gridTemplateColumns: "repeat(3, 320px)",
        rowGap: 200,
        alignItems: "start",
        justifyItems: "start",
      }}
    >
      {OPTIONS.map((option) => (
        <PickedMenu key={option.mode} mode={option.mode} />
      ))}
      <PickedMenu mode="approval-required" options={MANAGED_OPTIONS} />
    </div>
  ),
};
