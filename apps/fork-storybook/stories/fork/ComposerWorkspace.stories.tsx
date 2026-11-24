import type { Meta, StoryObj } from "@storybook/react-vite";
import type { RuntimeMode } from "@t3tools/contracts";
import { type ComponentProps, useState } from "react";

import type { EnvMode } from "~/components/BranchToolbar.logic";
import { ComposerControlIcon } from "~/components/chat/ComposerControl";
import { runtimeModeConfig } from "~/components/chat/runtimeModeConfig";
import { ComposerRuntimeModeTrigger } from "~/custom/ComposerShell";
import { ComposerWorkspaceFooter } from "~/custom/ComposerWorkspaceFooter";
import { ShieldOffFilledIcon } from "~/custom/icons/ShieldOffFilledIcon";
import { ThreadContextReadout } from "~/custom/ThreadContextReadout";

import { Row, Stack } from "../Specimen.tsx";
import { StoryComposer } from "../StoryComposer.tsx";

type ReadoutProps = ComponentProps<typeof ThreadContextReadout>;

const PROJECT: ReadoutProps["project"] = { title: "no3ycode", repositoryIdentity: null };

const READOUT: ReadoutProps = {
  project: PROJECT,
  isGitRepo: true,
  envMode: "local",
  activeWorktreePath: null,
  activeThreadBranch: "t3/design-lint-stories",
  currentGitBranch: "t3/design-lint-stories",
};

/** The composer with the thread's project and branch read out above its prompt. */
function Readout(props: ReadoutProps) {
  return (
    <div className="w-[736px] max-w-full">
      <StoryComposer prompt="Ask anything" context={<ThreadContextReadout {...props} />} />
    </div>
  );
}

const meta = {
  title: "Fork/Composer workspace",
  component: Readout,
  tags: ["autodocs"],
  parameters: { surface: "composer" },
  args: READOUT,
} satisfies Meta<typeof Readout>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A started thread's context: its project, then its branch, which copies its name (or its link
    on a hosted repository) on click. */
export const Playground: Story = {};

/** On a branch, in a worktree, and outside git, where only the project shows. */
export const Readouts: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack gap={3}>
      <Readout {...READOUT} />
      <Readout {...READOUT} envMode="worktree" activeWorktreePath="/Users/story/.worktrees/a" />
      <Readout {...READOUT} isGitRepo={false} activeThreadBranch={null} currentGitBranch={null} />
    </Stack>
  ),
};

/** The bottom half of the branch and workspace popup: run here or in a new worktree, or go back
    to the last worktree. Locked once the thread has started. */
export const WorkspaceFooter: Story = {
  name: "Workspace footer",
  parameters: { surface: "stage", controls: { disable: true } },
  render: function Render() {
    const [mode, setMode] = useState<EnvMode>("local");
    const popup = "w-72 rounded-xl border border-border bg-popover p-1 text-popover-foreground";
    return (
      <Stack gap={4}>
        <div className={popup}>
          <ComposerWorkspaceFooter
            envLocked={false}
            effectiveEnvMode={mode}
            activeWorktreePath={null}
            onEnvModeChange={setMode}
            previousWorktreeLabel="design-lint-stories"
            previousWorktreeBranch="t3/design-lint-stories"
            onUsePreviousWorktree={() => setMode("worktree")}
          />
        </div>
        <div className={popup}>
          <ComposerWorkspaceFooter
            envLocked
            effectiveEnvMode="worktree"
            activeWorktreePath="/Users/story/.worktrees/a"
            onEnvModeChange={() => {}}
          />
        </div>
      </Stack>
    );
  },
};

const MODE_LABELS: Record<RuntimeMode, string> = {
  "approval-required": "Supervised",
  "auto-accept-edits": "Auto-accept edits",
  auto: "Auto",
  "full-access": "Full access",
};

/** The permissions chip in the control row, per mode; full access wears the filled shield. */
export const PermissionsTrigger: Story = {
  name: "Permissions trigger",
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack gap={3}>
      {(Object.keys(MODE_LABELS) as RuntimeMode[]).map((mode) => (
        <Row key={mode} label={mode}>
          <div className="w-[736px] max-w-full">
            <StoryComposer
              prompt="Ask anything"
              modeControls={
                <ComposerRuntimeModeTrigger runtimeMode={mode} size="xs">
                  <ComposerControlIcon
                    icon={
                      mode === "full-access" ? ShieldOffFilledIcon : runtimeModeConfig[mode].icon
                    }
                    size="xs"
                  />
                  {MODE_LABELS[mode]}
                </ComposerRuntimeModeTrigger>
              }
            />
          </div>
        </Row>
      ))}
    </Stack>
  ),
};
