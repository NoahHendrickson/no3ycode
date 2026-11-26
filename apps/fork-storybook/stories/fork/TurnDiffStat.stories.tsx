import type { Meta, StoryObj } from "@storybook/react-vite";
import { CheckpointRef, MessageId, RunId } from "@t3tools/contracts";

import { ForkTurnDiffStat } from "~/custom/ForkTurnDiffStat";

const summary = {
  runId: RunId.make("run-story"),
  completedAt: "2026-11-26T00:00:00Z",
  assistantMessageId: MessageId.make("assistant-story"),
  checkpointTurnCount: 1,
  checkpointRef: CheckpointRef.make("checkpoint-story"),
  status: "ready" as const,
  files: [
    {
      path: "apps/web/src/custom/ForkTurnDiffStat.tsx",
      kind: "added",
      additions: 36,
      deletions: 0,
    },
    {
      path: "apps/web/src/components/chat/MessagesTimeline.tsx",
      kind: "modified",
      additions: 56,
      deletions: 144,
    },
  ],
};

const meta = {
  title: "Fork/Turn diff stat",
  component: ForkTurnDiffStat,
  tags: ["autodocs"],
  args: { summary, onOpenTurnDiff: () => {} },
  decorators: [
    (Story) => (
      <div className="flex w-[736px] items-center text-sm text-muted-foreground">
        <span className="px-1">Worked for 41m 4s</span>
        <span className="ms-auto flex">{Story()}</span>
      </div>
    ),
  ],
} satisfies Meta<typeof ForkTurnDiffStat>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A finished turn's diff on its "Worked for" row; it opens the turn's diff. */
export const Default: Story = {};
