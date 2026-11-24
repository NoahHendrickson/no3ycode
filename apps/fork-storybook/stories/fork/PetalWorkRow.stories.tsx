import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentProps } from "react";

import { resolvePullRequestState } from "~/components/pullRequest/pullRequestPresentation";
import { BotThreadsRowView } from "~/custom/bots/BotThreadsPanel";
import { BotThreadsPanelControls } from "~/custom/bots/BotThreadsPanelControls";
import { EMPTY_BOT_THREADS_VIEW, useBotThreadsViewStore } from "~/custom/bots/botThreadsPanelStore";

type RowProps = ComponentProps<typeof BotThreadsRowView>;

const noop = () => {};

const BASE: RowProps = {
  status: { label: "Completed", mark: "dot", tone: "done" },
  seed: "petal-story",
  title: "Nightly dependency bumps",
  time: "12m",
  pullRequest: null,
  branch: "petal/deps-nov-18",
  hasWorktree: true,
  current: false,
  onOpen: noop,
};

const ROWS: ReadonlyArray<readonly [string, RowProps]> = [
  [
    "Working",
    {
      ...BASE,
      status: { label: "Working", mark: "working" },
      title: "Triage new issues",
      time: "now",
    },
  ],
  [
    "Open PR",
    {
      ...BASE,
      pullRequest: {
        number: 361,
        state: resolvePullRequestState({ state: "open", isDraft: false }),
      },
    },
  ],
  [
    "Draft PR",
    {
      ...BASE,
      title: "Refresh the model manifest",
      pullRequest: {
        number: 362,
        state: resolvePullRequestState({ state: "open", isDraft: true }),
      },
    },
  ],
  [
    "Merged PR",
    {
      ...BASE,
      title: "Weekly upstream sync",
      time: "2h",
      pullRequest: {
        number: 363,
        state: resolvePullRequestState({ state: "merged", isDraft: false }),
      },
    },
  ],
  [
    "Closed PR",
    {
      ...BASE,
      title: "Retry flaky shards",
      time: "1d",
      pullRequest: {
        number: 340,
        state: resolvePullRequestState({ state: "closed", isDraft: false }),
      },
    },
  ],
  [
    "Failed",
    {
      ...BASE,
      status: { label: "Failed", mark: "dot", tone: "failed" },
      title: "Release smoke check",
      branch: null,
      hasWorktree: false,
    },
  ],
  ["Current", { ...BASE, current: true, title: "Docs link audit" }],
];

const meta = {
  title: "Fork/Petal work row",
  component: BotThreadsRowView,
  tags: ["autodocs"],
  parameters: { surface: "sidebar" },
  args: BASE,
  decorators: [(Story) => <ul className="w-80">{Story()}</ul>],
} satisfies Meta<typeof BotThreadsRowView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** A Petal's threads as its work panel lists them: status, title, age, pull request, checkout. */
export const States: Story = {
  render: () => (
    <>
      {ROWS.map(([name, row]) => (
        <BotThreadsRowView key={name} {...row} seed={name} />
      ))}
    </>
  ),
};

const STORY_BOT_KEY = "story:petal";

/** The work panel's header controls: search, the filter menu (status groups, and projects when
    there is a choice) and sort. They act on the panel's view, held here as the panel holds it. */
export const Controls: Story = {
  decorators: [(Story) => <div className="flex w-80 items-center justify-end">{Story()}</div>],
  render: function Render() {
    const view = useBotThreadsViewStore(
      (state) => state.byBotKey[STORY_BOT_KEY] ?? EMPTY_BOT_THREADS_VIEW,
    );
    return (
      <BotThreadsPanelControls
        botKey={STORY_BOT_KEY}
        view={view}
        projects={[
          { id: "no3ycode", title: "no3ycode" },
          { id: "marketing-site", title: "marketing-site" },
        ]}
      />
    );
  },
};
