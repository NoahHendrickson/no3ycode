import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Input } from "~/components/ui/input";
import { ForkChoiceSelect } from "~/custom/ForkChoiceSelect";
import {
  ForkChatStreamSizeRow,
  ForkFontPresetPicker,
  ForkSidebarFontSizeRow,
} from "~/custom/ForkTypographyControls";
import { ForkUpstreamCreditRow } from "~/custom/ForkUpstreamCreditRow";
import { SettingsRow, SettingsSection } from "~/components/settings/settingsLayout";

const DENSITIES = ["compact", "comfortable", "spacious"] as const;
type Density = (typeof DENSITIES)[number];
const DENSITY_LABELS: Record<Density, string> = {
  compact: "Compact",
  comfortable: "Comfortable",
  spacious: "Spacious",
};

/** A pick-one fork setting in a Settings row, its value held here. */
function ChoiceRow() {
  const [value, setValue] = useState<Density>("comfortable");
  return (
    <SettingsRow
      title="Density"
      description="How much room the list gives each row."
      control={
        <ForkChoiceSelect
          value={value}
          options={DENSITIES}
          labels={DENSITY_LABELS}
          onChange={setValue}
          ariaLabel="Density"
        />
      }
    />
  );
}

/** The interface font's preset select; Custom… (or a family no preset names) shows the field. */
function FontRow() {
  const [family, setFamily] = useState("Inter Variable");
  return (
    <SettingsRow
      title="Interface font"
      description="The font for everything but code."
      control={
        <ForkFontPresetPicker
          title="Interface font"
          value={family}
          onPick={setFamily}
          familyField={
            <Input
              size="sm"
              className="w-full sm:w-44"
              value={family}
              onChange={(event) => setFamily(event.target.value)}
              aria-label="Interface font family"
            />
          }
        />
      }
    />
  );
}

/** The fork's own Settings rows, in a section at the page's width. */
function Rows() {
  return (
    <div className="w-[44rem] max-w-full">
      <SettingsSection title="Appearance">
        <ChoiceRow />
        <FontRow />
        <ForkSidebarFontSizeRow />
        <ForkChatStreamSizeRow />
      </SettingsSection>
      <SettingsSection title="About">
        <ForkUpstreamCreditRow />
      </SettingsSection>
    </div>
  );
}

const meta = {
  title: "Fork/Settings rows",
  component: Rows,
  tags: ["autodocs"],
  parameters: { surface: "page" },
} satisfies Meta<typeof Rows>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A pick-one select, the font preset picker, the two size rows (a reset appears once a size
    leaves its default; saved on this device), and the About credit. */
export const Playground: Story = {};
