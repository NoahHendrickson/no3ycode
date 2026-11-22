import type { Meta, StoryObj } from "@storybook/react-vite";
import { EnvironmentId, type PullRequestState, ThreadId } from "@t3tools/contracts";
import { useState } from "react";

import { resolvePullRequestState } from "~/components/pullRequest/pullRequestPresentation";
import {
  BotDigestAskActions,
  BotDigestAskCardView,
  botDigestAskTile,
  BotDigestView,
} from "~/custom/bots/BotDigest";
import { BotDigestLinkRow } from "~/custom/bots/BotDigestItem";
import type { BotDigestLinks } from "~/custom/bots/botDigestItemLinks";

import { Stack } from "../Specimen.tsx";

type PullRequestKind = PullRequestState | "draft";

interface Ask {
  readonly question: string;
  readonly detail: string | null;
  /** The pull request it is about, which colours its tile; none draws the needs-input tile. */
  readonly pullRequest: { readonly kind: PullRequestKind; readonly number: number } | null;
  readonly thread: string | null;
  readonly answers: ReadonlyArray<string>;
}

interface DigestProps {
  readonly status: string | null;
  readonly asks: ReadonlyArray<Ask>;
  /** How many of the last asks start dismissed. */
  readonly dismissed?: number;
}

const environmentId = EnvironmentId.make("story");
const noop = () => {};
const SYNCED_AT = "2026-11-22T09:00:00.000Z";

const presentation = (kind: PullRequestKind) =>
  resolvePullRequestState({
    state: kind === "draft" ? "open" : kind,
    isDraft: kind === "draft",
  });

function links(ask: Ask): BotDigestLinks {
  const pullRequest = ask.pullRequest;
  return {
    threads:
      ask.thread === null
        ? []
        : [
            {
              link: { environmentId: null, threadId: ThreadId.make(`story-${ask.thread}`) },
              label: ask.thread,
              shell: undefined,
            },
          ],
    pullRequests:
      pullRequest === null
        ? []
        : [
            {
              url: `https://github.com/example/app/pull/${pullRequest.number}`,
              number: pullRequest.number,
              snapshot: {
                state: pullRequest.kind === "draft" ? "open" : pullRequest.kind,
                isDraft: pullRequest.kind === "draft",
                title: ask.question,
                headBranch: "petal/story",
                baseBranch: "main",
                updatedAt: null,
                syncedAt: SYNCED_AT,
              },
              branch: null,
              thread: undefined,
            },
          ],
  };
}

/** The digest as BotDigestAsks draws it, from plain asks: the pager moves between them, and
    Dismiss and "Show N dismissed" hide and bring back asks. Asks are keyed by position. */
function Digest(props: DigestProps) {
  const [page, setPage] = useState(0);
  const [dismissed, setDismissed] = useState<ReadonlyArray<number>>(() =>
    props.asks.flatMap((_, index) =>
      index >= props.asks.length - (props.dismissed ?? 0) ? [index] : [],
    ),
  );
  if (props.asks.length === 0 && props.status === null) return null;
  const shown = props.asks.flatMap((_, index) => (dismissed.includes(index) ? [] : [index]));
  const at = Math.min(page, Math.max(0, shown.length - 1));
  const shownIndex = shown[at];
  const ask = shownIndex === undefined ? undefined : props.asks[shownIndex];
  const tile =
    ask === undefined
      ? null
      : botDigestAskTile(
          ask.pullRequest !== null,
          ask.pullRequest === null ? null : presentation(ask.pullRequest.kind),
        );
  return (
    <BotDigestView
      status={props.status}
      hiddenCount={dismissed.length}
      onShowDismissed={() => setDismissed([])}
      askKeys={shown.map(String)}
      at={at}
      onPage={setPage}
    >
      {shownIndex === undefined || ask === undefined || tile === null ? null : (
        <BotDigestAskCardView
          key={shownIndex}
          question={ask.question}
          detail={ask.detail}
          icon={tile.icon}
          toneClassName={tile.toneClassName}
          onDismiss={() => setDismissed([...dismissed, shownIndex])}
          links={
            <BotDigestLinkRow links={links(ask)} environmentId={environmentId} localVisits={{}} />
          }
          actions={<BotDigestAskActions answers={ask.answers} onAnswer={noop} onReply={noop} />}
        />
      )}
    </BotDigestView>
  );
}

const PUSH: Ask = {
  question: "OK to push the dependency bumps and open a PR?",
  detail: "Eleven packages moved a minor version; the web tests pass on the branch.",
  pullRequest: null,
  thread: "Nightly dependency bumps",
  answers: ["Open PR", "Hold"],
};

const CHANNEL: Ask = {
  question: "Which release channel should tonight's build go to?",
  detail:
    "The last nightly went to beta, but two of the fixes it carries are still waiting on review, and the stable channel has not had a build since Thursday's hotfix. Beta testers asked for the sidebar fix first; stable users are waiting on the crash fix.",
  pullRequest: null,
  thread: null,
  answers: [],
};

const REVIEW: Ask = {
  question: "Two review comments ask for a different approach. Rework it or reply?",
  detail: "Both want the retry moved into the adapter instead of the worker.",
  pullRequest: { kind: "open", number: 361 },
  thread: "Retry flaky shards",
  answers: ["Rework", "Reply for me"],
};

const PULL_REQUEST_ASKS: ReadonlyArray<readonly [string, Ask]> = [
  ["Open", REVIEW],
  [
    "Draft",
    {
      question: "Mark the manifest refresh ready for review?",
      detail: "It still lists two models the remote manifest dropped.",
      pullRequest: { kind: "draft", number: 362 },
      thread: "Refresh the model manifest",
      answers: ["Mark ready", "Keep as draft"],
    },
  ],
  [
    "Merged",
    {
      question: "The upstream sync merged. Delete its branch and worktree?",
      detail: null,
      pullRequest: { kind: "merged", number: 363 },
      thread: "Weekly upstream sync",
      answers: ["Delete", "Keep"],
    },
  ],
  [
    "Closed",
    {
      question: "Someone closed the docs link audit. Open it again?",
      detail: "It was closed without a comment an hour after the last push.",
      pullRequest: { kind: "closed", number: 340 },
      thread: "Docs link audit",
      answers: [],
    },
  ],
];

const STATUS = "Watching three pull requests; next check at 14:00.";

interface PlaygroundArgs {
  readonly status: string;
  readonly hiddenCount: number;
  readonly askCount: number;
  readonly question: string;
  readonly detail: string;
  readonly tile: "needs input" | PullRequestKind;
  readonly answers: ReadonlyArray<string>;
}

const meta = {
  title: "Fork/Petal digest",
  tags: ["autodocs"],
  parameters: { surface: "composer", router: true },
  args: {
    status: STATUS,
    hiddenCount: 0,
    askCount: 1,
    question: PUSH.question,
    detail: PUSH.detail ?? "",
    tile: "needs input",
    answers: PUSH.answers,
  },
  argTypes: {
    hiddenCount: { control: { type: "number", min: 0 } },
    askCount: { control: { type: "range", min: 0, max: 6 } },
    tile: {
      control: "inline-radio",
      options: ["needs input", "open", "draft", "merged", "closed"],
    },
  },
  decorators: [(Story) => <div className="w-[736px] max-w-full">{Story()}</div>],
  render: (args) => {
    const first: Ask = {
      question: args.question,
      detail: args.detail === "" ? null : args.detail,
      pullRequest: args.tile === "needs input" ? null : { kind: args.tile, number: 361 },
      thread: "Nightly dependency bumps",
      answers: args.answers,
    };
    const pool = [first, CHANNEL, ...PULL_REQUEST_ASKS.map(([, ask]) => ask)];
    // The dismissed asks follow the shown ones, round the pool again past its end.
    const asks = Array.from(
      { length: args.askCount + args.hiddenCount },
      (_, index) => pool[index % pool.length]!,
    );
    return (
      <Digest
        key={`${args.askCount}:${args.hiddenCount}`}
        status={args.status === "" ? null : args.status}
        asks={asks}
        dismissed={args.hiddenCount}
      />
    );
  },
} satisfies Meta<PlaygroundArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The status line alone: nothing needs the owner. */
export const StatusOnly: Story = {
  name: "Status only",
  render: () => <Digest status={STATUS} asks={[]} />,
};

/** An ask the bot offered answers to: each is an outline button, and Reply steps back to ghost
    beside them. Without a status line the strip reads "Needs you". */
export const OfferedAnswers: Story = {
  name: "Offered answers",
  render: () => <Digest status={null} asks={[PUSH]} />,
};

/** An ask with no offered answers: Reply is the way to answer, so it is the outline button. The
    detail clamps at two lines. */
export const ReplyOnly: Story = {
  name: "Reply only",
  render: () => <Digest status={STATUS} asks={[CHANNEL]} />,
};

/** Two or more asks show one at a time, with the pager in the strip: the dot on show is a dash. */
export const SeveralAsks: Story = {
  name: "Several asks",
  render: () => <Digest status={STATUS} asks={[PUSH, CHANNEL, REVIEW]} />,
};

/** An ask about a pull request takes its tile from the pull request's state. */
export const PullRequestStates: Story = {
  name: "Pull request states",
  render: () => (
    <Stack gap={2}>
      {PULL_REQUEST_ASKS.map(([name, ask]) => (
        <Digest key={name} status={`${name} pull request`} asks={[ask]} />
      ))}
    </Stack>
  ),
};

/** Dismissed asks are counted in the strip until "Show N dismissed" brings them back, with or
    without an ask still on show. */
export const DismissedHidden: Story = {
  name: "Dismissed hidden",
  render: () => (
    <Stack gap={2}>
      <Digest status={STATUS} asks={[CHANNEL, PUSH, REVIEW]} dismissed={2} />
      <Digest status={STATUS} asks={[PUSH, CHANNEL, REVIEW]} dismissed={3} />
    </Stack>
  ),
};
