import type { Meta, StoryObj } from "@storybook/react-vite";
import { EnvironmentId } from "@t3tools/contracts";
import { useState } from "react";

import {
  TimelineRowActivityCtx,
  type TimelineRowActivityState,
  TimelineRowCtx,
  type TimelineRowSharedState,
} from "~/components/chat/timelineRowContext";
import { WorkingTimelineRow } from "~/components/chat/TimelineWorkGroupRows";
import { ForkLiveStatusLine } from "~/custom/ForkLiveStatusLine";
import type { ForkStatusLineRow } from "~/custom/forkWorkingRowLast";

import { Row, Stack } from "../Specimen.tsx";

const startedAt = () => new Date(Date.now() - 83_000).toISOString();

/** What the line can show besides the thinking word, and whether it carries a timer or a group. */
interface LineProps {
  timer: boolean;
  group: boolean;
  label?: string;
  providerStartingLabel?: string;
  /** The line by itself, with a fixed timer and nothing trailing, outside the timeline's row. */
  bare?: boolean;
}

/** The timeline's working row, folded into the live status line as MessagesTimeline folds it.
    The line reads the row's group toggle and the environment's clock from the timeline. */
function StatusLine({ timer, group, label, providerStartingLabel, bare = false }: LineProps) {
  const [expanded, setExpanded] = useState(false);
  const [start] = useState(startedAt);
  const createdAt = timer ? start : null;
  const row: ForkStatusLineRow = {
    kind: "working",
    id: "working-indicator-row",
    createdAt,
    forkWordSeed: "story",
    forkLive:
      group || label !== undefined
        ? {
            kind: "thinking",
            id: "live-activity",
            createdAt,
            ...(label === undefined ? {} : { label }),
            ...(group ? { groupId: "group-story", expanded } : {}),
          }
        : null,
  };
  // Only what the line reads; the rest of the timeline's state stays out of the story.
  const shared: Pick<TimelineRowSharedState, "activeThreadEnvironmentId" | "onToggleWorkGroup"> = {
    activeThreadEnvironmentId: EnvironmentId.make("story"),
    onToggleWorkGroup: () => setExpanded(!expanded),
  };
  const activity: TimelineRowActivityState = {
    isWorking: true,
    isCompacting: false,
    isRevertingCheckpoint: false,
    awaitingUser: false,
    isPreparingWorktree: false,
    providerStartingLabel: providerStartingLabel ?? null,
    latestRunId: null,
    backgroundWorktreeSetup: null,
    liveAnswerPreview: null,
  };
  return (
    <TimelineRowCtx value={shared as TimelineRowSharedState}>
      <TimelineRowActivityCtx value={activity}>
        <div className="w-[640px] max-w-full">
          {bare ? (
            <ForkLiveStatusLine row={row} timer={timer ? "1m 23s" : null} trailing={null} />
          ) : (
            <WorkingTimelineRow row={row} />
          )}
        </div>
      </TimelineRowActivityCtx>
    </TimelineRowCtx>
  );
}

const meta = {
  title: "Fork/Live status line",
  component: StatusLine,
  tags: ["autodocs"],
  args: { timer: true, group: true },
} satisfies Meta<typeof StatusLine>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One line at the end of a running turn: the working mark, what the agent is doing (a thinking
    word unless something says more), the elapsed time, and the chevron that opens the turn's
    work group. */
export const Playground: Story = {};

/** With and without the group toggle and the timer, a label the run sets, and the provider
    starting up. */
export const Variants: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack gap={3}>
      <Row label="Word">
        <StatusLine timer={false} group={false} />
      </Row>
      <Row label="Timer">
        <StatusLine timer group={false} />
      </Row>
      <Row label="Group">
        <StatusLine timer={false} group />
      </Row>
      <Row label="Group, timer">
        <StatusLine timer group />
      </Row>
      <Row label="Label">
        <StatusLine timer group label="Waiting on 2 subagents" />
      </Row>
      <Row label="Starting">
        <StatusLine timer group={false} providerStartingLabel="Starting Claude…" />
      </Row>
    </Stack>
  ),
};

/** ForkLiveStatusLine on its own, as the working row draws it: the mark, the label, the timer it
    is handed, and the chevron when the line toggles a group. */
export const LineAlone: Story = {
  name: "Line alone",
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack gap={3}>
      <Row label="Word">
        <StatusLine bare timer={false} group={false} />
      </Row>
      <Row label="Group, timer">
        <StatusLine bare timer group />
      </Row>
      <Row label="Label">
        <StatusLine bare timer={false} group label="Waiting on 2 subagents" />
      </Row>
    </Stack>
  ),
};
