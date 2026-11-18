import type { Meta, StoryObj } from "@storybook/react-vite";
// The shim itself: lucide-react is the same module, but its namespace import is lint-restricted.
import * as Icons from "~/custom/icons/lucide-hugeicons";
import type { ComponentType, SVGProps } from "react";
import { useState } from "react";

// Everything the lucide-react → Phosphor shim exports: the icon set components can reach. Names
// are lucide's (what call sites write); the glyph is Phosphor at the shim's weight.
const ICONS = Object.entries(Icons)
  .filter(
    ([name, value]) => /^[A-Z]/.test(name) && name.endsWith("Icon") && typeof value !== "string",
  )
  .map(([name, value]) => ({ name, Icon: value as ComponentType<SVGProps<SVGSVGElement>> }))
  .toSorted((a, b) => a.name.localeCompare(b.name));

function IconGrid() {
  const [query, setQuery] = useState("");
  const shown = ICONS.filter((icon) => icon.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="flex flex-col gap-6">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={`Search ${ICONS.length} icons`}
        className="h-8 w-72 rounded-md border border-input bg-transparent px-2.5 text-sm text-foreground outline-none placeholder:text-placeholder"
      />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-2">
        {shown.map(({ name, Icon }) => (
          <figure
            key={name}
            data-icon={name}
            className="flex flex-col items-center gap-2 rounded-lg border border-border p-3"
          >
            <Icon className="size-5 text-foreground" />
            <figcaption className="w-full truncate text-center font-mono text-[10px] text-muted-foreground">
              {name.replace(/Icon$/, "")}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

const meta = {
  title: "Foundations/Icons",
  parameters: { surface: "bare" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const All: Story = { render: () => <IconGrid /> };

export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-6 text-foreground">
      {[3, 3.5, 4, 4.5, 5, 6].map((size) => (
        <figure key={size} className="flex flex-col items-center gap-2">
          <Icons.SettingsIcon style={{ width: size * 4, height: size * 4 }} />
          <figcaption className="font-mono text-[11px] text-muted-foreground">
            {size * 4}px
          </figcaption>
        </figure>
      ))}
    </div>
  ),
};
