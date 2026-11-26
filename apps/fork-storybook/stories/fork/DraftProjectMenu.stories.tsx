import type { Meta, StoryObj } from "@storybook/react-vite";
import { EnvironmentId } from "@t3tools/contracts";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { ComboboxTrigger } from "~/components/ui/combobox";
import { DraftProjectPicker } from "~/custom/DraftProjectMenuPopup";
import { FolderIcon } from "~/custom/icons/lucide-hugeicons";
import { type DraftProjectMenuChoices, NO_PROJECT_VALUE } from "~/custom/useDraftProjectChoices";

const environmentId = EnvironmentId.make("story");

const ENTRIES: DraftProjectMenuChoices["entries"] = (
  [
    ["no3ycode", "violet"],
    ["marketing-site", "emerald"],
    ["dither-studio", "amber"],
    ["portfolio", "rose"],
    ["thinking-states", "sky"],
  ] as const
).map(([title, color]) => ({
  group: { projectKey: title, displayName: title },
  targetProject: {
    environmentId,
    workspaceRoot: `/Users/story/${title}`,
    title,
    faviconPath: null,
    projectIcon: { kind: "monogram", text: title.slice(0, 1).toUpperCase(), color },
  },
}));

/** The menu open above its chip, as the draft composer opens it, with the pick held. */
function OpenMenu(props: { readonly noProject: boolean }) {
  const [value, setValue] = useState<string>("no3ycode");
  const choices: DraftProjectMenuChoices = {
    entries: ENTRIES,
    value,
    pick: setValue,
    noProjectEnvironmentId: props.noProject ? environmentId : null,
    recentKeys: ENTRIES.map((entry) => entry.group.projectKey),
  };
  const label = ENTRIES.find((entry) => entry.group.projectKey === value)?.group.displayName;
  return (
    <div className="pt-64">
      <DraftProjectPicker choices={choices} defaultOpen>
        <ComboboxTrigger render={<Button variant="ghost" size="sm" />}>
          <FolderIcon />
          {value === NO_PROJECT_VALUE ? "No project" : label}
        </ComboboxTrigger>
      </DraftProjectPicker>
    </div>
  );
}

const meta = {
  title: "Fork/Draft project menu",
  component: OpenMenu,
  tags: ["autodocs"],
  parameters: { surface: "stage" },
  args: { noProject: true },
} satisfies Meta<typeof OpenMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The draft's project picker: search, No project, pinned projects, then every pickable
    project with its favicon, sorted by recent use or name, and Add a project. The filled row is
    the draft's project. */
export const Playground: Story = {};

/** Where no environment can hold a project-less thread, No project is left out. */
export const ProjectsOnly: Story = {
  name: "Projects only",
  args: { noProject: false },
};
