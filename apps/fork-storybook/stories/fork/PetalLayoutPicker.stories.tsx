import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties } from "react";
import { useArgs } from "storybook/preview-api";

import { Button } from "~/components/ui/button";
import { Menu, MenuPopup, MenuSeparator, MenuTrigger } from "~/components/ui/menu";
import { type PetalLayout, PetalLayoutPicker } from "~/custom/bots/PetalLayoutPicker";
import { SettingsIcon } from "~/custom/icons/lucide-hugeicons";
import { OptionCheckboxItem } from "~/custom/SidebarV2ChromeRows";

type PickerProps = Parameters<typeof PetalLayoutPicker>[0];

// The canvas centres; a popup opens below its trigger.
const TOP: CSSProperties = { alignSelf: "flex-start", paddingTop: 24 };

/** The Petals row's View options menu, as SidebarV2BotsSection opens it: the picker, and Compact
    cards under it while the layout is List. */
function ViewOptions({ layout, onLayoutChange }: PickerProps) {
  return (
    <Menu defaultOpen modal={false}>
      <MenuTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label="Petal view options" />}
      >
        <SettingsIcon className="size-4 shrink-0" />
      </MenuTrigger>
      <MenuPopup align="end" data-fork-glass-rim data-fork-tab-menu="sidebar" className="min-w-48">
        <PetalLayoutPicker layout={layout} onLayoutChange={onLayoutChange} />
        {layout === "list" ? (
          <>
            <MenuSeparator className="-mx-1" />
            <OptionCheckboxItem
              checked={false}
              onCheckedChange={() => {}}
              testId="story-compact-cards"
            >
              Compact cards
            </OptionCheckboxItem>
          </>
        ) : null}
      </MenuPopup>
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
      <div style={TOP}>
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
    <div style={{ ...TOP, display: "flex", gap: 240 }}>
      <ViewOptions layout="list" onLayoutChange={() => {}} />
      <ViewOptions layout="grid" onLayoutChange={() => {}} />
    </div>
  ),
};
