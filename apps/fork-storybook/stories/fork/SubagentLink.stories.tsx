import type { Meta, StoryObj } from "@storybook/react-vite";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { ContextChip, ContextChipLabel } from "~/components/ContextChip";
import { ThreadContextChip } from "~/components/ThreadContextChip";
import type { ForkSubagentLinkKind } from "~/custom/forkSubagentLinkLogic";
import { SubagentLinkMark } from "~/custom/ForkSubagentLinkChip";

import { Row, Stack } from "../Specimen.tsx";

const environmentId = EnvironmentId.make("story");

type Status = ForkSubagentLinkKind | "idle";

const STATUSES: ReadonlyArray<Status> = [
  "working",
  "waiting",
  "approval",
  "input",
  "done",
  "failed",
  "idle",
];

/** ForkSubagentLinkChip's capsule from its own parts: the chip reads the child from the
    environment's thread shells, which a story has no server to fill. Idle has no status. */
function SubagentLink({ status, title }: { status: Status; title: string }) {
  const threadId = ThreadId.make(`thread-subagent-${status}`);
  return (
    <ContextChip
      render={
        <Link
          to="/$environmentId/$threadId"
          params={{ environmentId, threadId }}
          draggable={false}
        />
      }
      aria-label={`Thread, ${title}, ${status}`}
      data-fork-subagent-link=""
      shape="capsule"
    >
      <SubagentLinkMark kind={status === "idle" ? null : status} seed={threadId} />
      <ContextChipLabel>{title}</ContextChipLabel>
    </ContextChip>
  );
}

/** An ordinary thread link in an assistant message: the real chip, as a capsule. */
function ThreadLink({ title }: { title: string }) {
  return (
    <ThreadContextChip
      record={{ environmentId, threadId: ThreadId.make("thread-linked"), title }}
      projectId={null}
      shape="capsule"
    />
  );
}

/** ChatMarkdown's prose, as an assistant message sets it. */
function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="chat-markdown w-full min-w-0 text-sm leading-relaxed text-foreground/[calc(90%+var(--appearance-contrast-boost)/10)] [overflow-wrap:anywhere] [word-break:break-word]">
      <p>{children}</p>
    </div>
  );
}

function Sentence({ status }: { status: Status }) {
  return (
    <Prose>
      I asked <SubagentLink status={status} title="Audit the composer cards" /> to diff the computed
      styles before and after the refactor.
    </Prose>
  );
}

const meta = {
  title: "Fork/Subagent link",
  component: Sentence,
  tags: ["autodocs"],
  parameters: { surface: "stage", router: true },
  args: { status: "working" },
  argTypes: { status: { control: "select", options: STATUSES } },
  decorators: [(Story) => <div className="w-[780px] max-w-full">{Story()}</div>],
} satisfies Meta<typeof Sentence>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A subagent named in an assistant message is a capsule with the sidebar's status mark, drawn
    still: working is a full green ring, waiting a muted dot, and done does not celebrate. The
    label keeps the prose's weight. */
export const Playground: Story = {};

/** Every status, then an ordinary thread link, which takes the same capsule with its project's
    icon, or the thread icon without a project. */
export const Statuses: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack gap={2}>
      {STATUSES.map((status) => (
        <Row key={status} label={status}>
          <Sentence status={status} />
        </Row>
      ))}
      <Row label="thread">
        <Prose>
          The earlier pass is in <ThreadLink title="Composer banner cards" />, with the before
          captures.
        </Prose>
      </Row>
    </Stack>
  ),
};
