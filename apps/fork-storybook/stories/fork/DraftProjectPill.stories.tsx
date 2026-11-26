import type { Meta, StoryObj } from "@storybook/react-vite";
import { EnvironmentId } from "@t3tools/contracts";
import { useState } from "react";

import { renderComposerContextStripFallback } from "~/custom/composerContextStrip";
import {
  DraftAddProjectButton,
  DraftProjectPillView,
  type DraftProjectPillViewChoices,
} from "~/custom/DraftProjectPill";
import { NO_PROJECT_VALUE } from "~/custom/useDraftProjectChoices";

import { Row, Stack } from "../Specimen.tsx";
import { StoryComposer } from "../StoryComposer.tsx";

const environmentId = EnvironmentId.make("story");

const ENTRIES: DraftProjectPillViewChoices["entries"] = (
  [
    ["no3ycode", "violet"],
    ["marketing-site", "emerald"],
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

type Selection = "project" | "no-project" | "unassigned" | "add";

/** The pill first in a new draft's context row, as ChatView mounts it while the draft has no
    toolbar yet; a pick in its menu moves the selection. */
function Composer(props: { readonly selection: Selection; readonly pending?: boolean }) {
  const [value, setValue] = useState<string>(
    props.selection === "no-project" ? NO_PROJECT_VALUE : "no3ycode",
  );
  const [kind, setKind] = useState(props.selection);
  const label = ENTRIES.find((entry) => entry.group.projectKey === value)?.group.displayName;
  const choices: DraftProjectPillViewChoices = {
    entries: ENTRIES,
    value: kind === "unassigned" ? "" : value,
    pick: (next) => {
      setValue(next);
      setKind(next === NO_PROJECT_VALUE ? "no-project" : "project");
    },
    noProjectEnvironmentId: environmentId,
    selection:
      kind === "project"
        ? { kind, label: label ?? "no3ycode" }
        : { kind: kind === "add" ? "unassigned" : kind },
    pending: props.pending ?? false,
  };
  return (
    <div className="w-[736px] max-w-full">
      <StoryComposer
        prompt="What should the agent do?"
        context={renderComposerContextStripFallback({
          leading:
            kind === "add" ? (
              <DraftAddProjectButton onAdd={() => {}} />
            ) : (
              <DraftProjectPillView choices={choices} />
            ),
        })}
      />
    </div>
  );
}

const meta = {
  title: "Fork/Draft project pill",
  component: Composer,
  tags: ["autodocs"],
  parameters: { surface: "composer" },
  args: { selection: "project", pending: false },
  argTypes: {
    selection: {
      control: "inline-radio",
      options: ["project", "no-project", "unassigned", "add"],
    },
  },
} satisfies Meta<typeof Composer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A draft's project chip; it opens the draft's project menu (Fork/Draft project menu). It reads
    the draft and the environment's projects, so the story hands the choices in. */
export const Playground: Story = {
  // The pill holds its pick in state; remount it when a control changes.
  render: (args) => <Composer key={`${args.selection}-${String(args.pending)}`} {...args} />,
};

/** A project, No project, nothing picked yet (shown in a short window, where the launchpad
    has no room), and Add a project when there is nothing to pick. */
export const Selections: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack gap={4}>
      {(["project", "no-project", "unassigned", "add"] as const).map((selection) => (
        <Row key={selection} label={selection}>
          <Composer selection={selection} />
        </Row>
      ))}
    </Stack>
  ),
};

/** While a pick is still landing the chip is busy, already naming the picked project. */
export const Pending: Story = {
  args: { pending: true },
};
