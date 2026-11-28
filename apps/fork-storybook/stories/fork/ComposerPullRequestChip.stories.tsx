import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  prStatusIndicator,
  ThreadPullRequestBadgeControl,
  type ThreadPr,
} from "~/components/ThreadStatusIndicators";
import type { PullRequestChecksState } from "@t3tools/contracts";
import { resolvePullRequestState } from "~/components/pullRequest/pullRequestPresentation";
import { PullRequestChipControl, PullRequestRowChip } from "~/custom/ComposerPullRequestChip";
import {
  resolvePullRequestChipChecks,
  resolvePullRequestChipState,
} from "~/custom/composerPullRequestChip.logic";

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

type ChecksArg = PullRequestChecksState | "none";

/** ComposerPullRequestChip's render, given the PR it would read from the thread and its branch
    status: the shared badge control drawn as a composer chip, filled by the PR's state, with
    its CI pill when the PR is open. */
function PullRequestChip({ state, checks }: { state: PrState; checks: ChecksArg }) {
  const pr = pullRequest(state);
  return (
    <ThreadPullRequestBadgeControl
      render={
        <PullRequestChipControl
          checks={resolvePullRequestChipChecks({
            badge: null,
            snapshot: { state: pr.state, checksState: checks === "none" ? null : checks },
          })}
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

function Composer({ state, checks = "none" }: { state: PrState; checks?: ChecksArg }) {
  return (
    <div className="w-[736px] max-w-full">
      <StoryComposer
        prompt="Ask anything"
        statusChips={<PullRequestChip state={state} checks={checks} />}
      />
    </div>
  );
}

const meta = {
  title: "Fork/Composer pull request chip",
  component: Composer,
  tags: ["autodocs"],
  parameters: { surface: "composer" },
  args: { state: "open", checks: "passing" },
  argTypes: {
    state: { control: "inline-radio", options: ["open", "draft", "merged", "closed"] },
    checks: { control: "inline-radio", options: ["none", "pending", "passing", "failing"] },
  },
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

/** An open or draft PR's CI as the chip's inner pill: amber while checks run, green once they
    pass, red when one fails. A PR with no checks, or a merged or closed one, shows none. */
export const Checks: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack gap={4}>
      {(["pending", "passing", "failing", "none"] as const).map((checks) => (
        <Row key={checks} label={checks}>
          <Composer state="open" checks={checks} />
        </Row>
      ))}
    </Stack>
  ),
};

/** The row variant a sprint's or coordinator's panel row wears (PullRequestRowChip, Basic UI kit
    551:2943): 22px, deeper, its CI pill 3px in. Each state, and an open PR's checks. */
export const RowVariant: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack gap={4}>
      {(["open", "draft", "merged", "closed"] as const).map((state) => (
        <Row key={state} label={state}>
          <PullRequestRowChip
            number={415}
            state={resolvePullRequestState({
              state: state === "draft" ? "open" : state,
              isDraft: state === "draft",
            })}
            chipState={state}
            checks={state === "open" ? "pending" : null}
          />
        </Row>
      ))}
    </Stack>
  ),
};
