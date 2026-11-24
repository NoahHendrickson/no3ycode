import type { Meta, StoryObj } from "@storybook/react-vite";

import { ComposerControl } from "~/components/chat/ComposerControl";
import {
  prStatusIndicator,
  ThreadPullRequestBadgeControl,
  type ThreadPr,
} from "~/components/ThreadStatusIndicators";
import { resolvePullRequestChipState } from "~/custom/composerPullRequestChip.logic";

import { Row, Stack } from "../Specimen.tsx";
import { StoryComposer } from "../StoryComposer.tsx";

type PrState = "open" | "draft" | "merged" | "closed";

function pullRequest(state: PrState): NonNullable<ThreadPr> {
  return {
    number: 415,
    title: "The thread's PR rides a chip above the composer",
    url: "https://github.com/NoahHendrickson/no3ycode/pull/415",
    baseRef: "custom",
    headRef: "t3/composer-pr-chip",
    state: state === "draft" ? "open" : state,
    isDraft: state === "draft",
  };
}

/** ComposerPullRequestChip's render, given the PR it would read from the thread and its branch
    status: the shared badge control drawn as a composer chip, filled by the PR's state. */
function PullRequestChip({ state }: { state: PrState }) {
  const pr = pullRequest(state);
  return (
    <ThreadPullRequestBadgeControl
      render={
        <ComposerControl
          size="xs"
          data-fork-composer-status-chip="pull-request"
          data-fork-pr-chip
          data-pr-state={resolvePullRequestChipState({ badge: null, pr, pullRequests: [] })}
        />
      }
      badge={null}
      pullRequests={[]}
      number={pr.number}
      url={pr.url}
      status={prStatusIndicator(pr, undefined)}
      onOpenList={() => {}}
      onOpenPullRequest={(event) => event.preventDefault()}
    />
  );
}

function Composer({ state }: { state: PrState }) {
  return (
    <div className="w-[736px] max-w-full">
      <StoryComposer prompt="Ask anything" statusChips={<PullRequestChip state={state} />} />
    </div>
  );
}

const meta = {
  title: "Fork/Composer pull request chip",
  component: Composer,
  tags: ["autodocs"],
  parameters: { surface: "composer" },
  args: { state: "open" },
  argTypes: { state: { control: "inline-radio", options: ["open", "draft", "merged", "closed"] } },
} satisfies Meta<typeof Composer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The thread's PR as a chip above the composer; it opens the PR, or the PR list when the
    thread has several. The chip itself reads the thread and its git status from the server, so
    the story draws its render with the PR handed in. */
export const Playground: Story = {};

/** Open, draft, merged and closed, each filled by its state. */
export const States: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack gap={4}>
      {(["open", "draft", "merged", "closed"] as const).map((state) => (
        <Row key={state} label={state}>
          <Composer state={state} />
        </Row>
      ))}
    </Stack>
  ),
};
