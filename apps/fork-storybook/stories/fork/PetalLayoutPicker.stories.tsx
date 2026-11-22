import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentProps } from "react";
import { useArgs } from "storybook/preview-api";

import { Button } from "~/components/ui/button";
import { Menu, MenuTrigger } from "~/components/ui/menu";
import { type PetalLayout, PetalLayoutPicker } from "~/custom/bots/PetalLayoutPicker";
import { PetalViewOptionsMenu } from "~/custom/bots/SidebarV2BotsSection";
import { SettingsIcon } from "~/custom/icons/lucide-hugeicons";

import { POPUP_ANCHOR } from "../Specimen.tsx";

type PickerProps = ComponentProps<typeof PetalLayoutPicker>;

/** The Petals row's View options, open. The trigger carries the tab-trigger stamp the sidebar's
    gives it, so Inlet joins it to the popup's tab. */
function ViewOptions({ layout, onLayoutChange }: PickerProps) {
  return (
    <Menu defaultOpen modal={false}>
      <MenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Petal view options"
            data-fork-tab-trigger=""
          />
        }
      >
        <SettingsIcon className="size-4 shrink-0" />
      </MenuTrigger>
      <PetalViewOptionsMenu
        layout={layout}
        onLayoutChange={onLayoutChange}
        compactCards={false}
        onCompactCardsChange={() => {}}
      />
    </Menu>
  );
}

const meta = {
  title: "Fork/Petal layout picker",
  component: PetalLayoutPicker,
  tags: ["autodocs"],
  parameters: { surface: "sidebar" },
  args: { layout: "list", onLayoutChange: () => {} },
  argTypes: { layout: { control: "inline-radio", options: ["list", "grid"] } },
} satisfies Meta<typeof PetalLayoutPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Picking an option moves the `layout` control, as it moves the Petals section. */
export const Playground: Story = {
  render: function Render(args) {
    const [, updateArgs] = useArgs<PickerProps>();
    return (
      <div style={POPUP_ANCHOR}>
        <ViewOptions
          layout={args.layout}
          onLayoutChange={(layout: PetalLayout) => updateArgs({ layout })}
        />
      </div>
    );
  },
};

/** Each layout picked: List keeps the Compact cards toggle under it, Grid has none. */
export const Layouts: Story = {
  render: () => (
    <div style={{ ...POPUP_ANCHOR, display: "flex", gap: 240 }}>
      <ViewOptions layout="list" onLayoutChange={() => {}} />
      <ViewOptions layout="grid" onLayoutChange={() => {}} />
    </div>
  ),
};
