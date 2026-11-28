import type { Meta, StoryObj } from "@storybook/react-vite";
import { EnvironmentId, ProviderDriverKind } from "@t3tools/contracts";
import type { ComponentProps } from "react";

import { resolvePullRequestState } from "~/components/pullRequest/pullRequestPresentation";
import { BotThreadsCompactRowView } from "~/custom/bots/BotThreadsCompactRow";
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

const CHIP_STATE = {
  "Open PR": "open",
  "Draft PR": "draft",
  "Merged PR": "merged",
  "Closed PR": "closed",
} as const;
const MERGED = resolvePullRequestState({ state: "merged", isDraft: false });
/** What each row has already landed: one merged, then more than the row shows. */
const MERGED_BEFORE: Partial<Record<string, ReadonlyArray<number>>> = {
  "Open PR": [358],
  "Draft PR": [355, 352, 349, 344],
};
const STORY_ENVIRONMENT = EnvironmentId.make("story");
const OPUS = {
  environmentId: STORY_ENVIRONMENT,
  instanceId: "claudeAgent",
  driver: ProviderDriverKind.make("claudeAgent"),
  label: "Opus 5.5",
  effort: "High",
};
const NEON = {
  environmentId: STORY_ENVIRONMENT,
  instanceId: "antigravity",
  driver: ProviderDriverKind.make("antigravity"),
  label: "Gemini 4 Neon",
  effort: "High",
};

/** The same threads on two lines each, as a sprint's and a coordinator's panels list them: the
    pull request as the composer's chip (its row variant), the thread's earlier merged ones (one,
    then "+N"), then the model the thread runs. */
export const Compact: Story = {
  render: () => (
    <>
      {ROWS.map(([name, row]) => (
        <BotThreadsCompactRowView
          key={name}
          {...row}
          seed={name}
          pullRequest={
            row.pullRequest === null
              ? null
              : {
                  ...row.pullRequest,
                  chipState: CHIP_STATE[name as keyof typeof CHIP_STATE],
                  checks: name === "Open PR" ? "pending" : null,
                }
          }
          model={name === "Closed PR" ? NEON : OPUS}
          mergedPullRequests={(MERGED_BEFORE[name] ?? []).map((number) => ({
            number,
            state: MERGED,
            chipState: "merged",
            checks: null,
          }))}
        />
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
