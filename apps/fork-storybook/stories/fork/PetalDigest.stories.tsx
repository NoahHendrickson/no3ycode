import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  EnvironmentId,
  type PullRequestState,
  RuntimeRequestId,
  ThreadId,
} from "@t3tools/contracts";
import { type ComponentProps, useState } from "react";

import { ComposerBanner } from "~/components/chat/ComposerBanner";
import { ComposerBannerStack } from "~/components/chat/ComposerBannerStack";
import { ComposerPendingUserInputPanel } from "~/components/chat/ComposerPendingUserInputPanel";
import { BotDigestBottom, BotDigestBottomInline } from "~/custom/bots/BotDigestBottom";
import { BotDigestAskCardView, BotDigestStatusView } from "~/custom/bots/BotDigest";
import { forkApprovalNoticeItem } from "~/custom/forkApprovalNotice";
import type { PendingApproval, PendingUserInput } from "~/session-logic";
import { BotDigestLinkRow, childLinks, resolveBotDigestLine } from "~/custom/bots/BotDigestItem";
import { Stack } from "../Specimen.tsx";
import { StoryComposer } from "../StoryComposer.tsx";

type BotDigestLinks = ComponentProps<typeof BotDigestLinkRow>["links"];
type DigestItem = Parameters<typeof resolveBotDigestLine>[0];
type EnvironmentThreadShell = Parameters<typeof resolveBotDigestLine>[1]["shells"][number];

type PullRequestKind = PullRequestState | "draft";

interface Ask {
  readonly question: string;
  readonly detail: string | null;
  /** The pull request it is about, shown with its state among the ask's links. */
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

/** The digest as BotDigestAsks draws it, from plain asks, in the composer's banner dock: the
    pager moves between asks, and Dismiss and "Show N dismissed" hide and bring them back. Asks
    are keyed by position. */
function Digest(props: DigestProps) {
  const [page, setPage] = useState(0);
  const [dismissed, setDismissed] = useState<ReadonlyArray<number>>(() =>
    props.asks.flatMap((_, index) =>
      index >= props.asks.length - (props.dismissed ?? 0) ? [index] : [],
    ),
  );
  const shown = props.asks.flatMap((_, index) => (dismissed.includes(index) ? [] : [index]));
  const at = Math.min(page, Math.max(0, shown.length - 1));
  const shownIndex = shown[at];
  const ask = shownIndex === undefined ? undefined : props.asks[shownIndex];
  const showDismissed = () => setDismissed([]);
  const banner =
    shownIndex === undefined || ask === undefined ? (
      <BotDigestStatusView
        status={props.status}
        hiddenCount={dismissed.length}
        onShowDismissed={showDismissed}
      />
    ) : (
      <BotDigestAskCardView
        key={shownIndex}
        question={ask.question}
        detail={ask.detail}
        links={links(ask)}
        environmentId={environmentId}
        answers={ask.answers}
        bottom={{
          paging: { at, count: shown.length, onPage: setPage },
          hiddenCount: dismissed.length,
          onShowDismissed: showDismissed,
        }}
        onDismiss={() => setDismissed([...dismissed, shownIndex])}
        onSend={noop}
        onReply={noop}
      />
    );
  return <StoryComposer prompt="Ask Release Petal" banners={banner} />;
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
  answers: ["Rework it", "Reply for me"],
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
  readonly pullRequest: "none" | PullRequestKind;
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
    pullRequest: "none",
    answers: PUSH.answers,
  },
  argTypes: {
    hiddenCount: { control: { type: "range", min: 0, max: 6 } },
    askCount: { control: { type: "range", min: 0, max: 6 } },
    pullRequest: {
      control: "inline-radio",
      options: ["none", "open", "draft", "merged", "closed"],
    },
  },
  decorators: [(Story) => <div className="w-[736px] max-w-full">{Story()}</div>],
  render: (args) => {
    const first: Ask = {
      question: args.question,
      detail: args.detail === "" ? null : args.detail,
      pullRequest: args.pullRequest === "none" ? null : { kind: args.pullRequest, number: 361 },
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

/** Nothing needs the owner: the status line alone, as a one-line card. */
export const StatusOnly: Story = {
  name: "Status only",
  render: () => <Digest status={STATUS} asks={[]} />,
};

/** An ask the bot offered answers to: they are its options, and Send stays off until one is
    picked. Reply, beside it, answers in your own words. */
export const OfferedAnswers: Story = {
  name: "Offered answers",
  render: () => <Digest status={null} asks={[PUSH]} />,
};

/** An ask with no offered answers: Reply is the way to answer, so it is the primary button. A
    long detail scrolls in the header, as a long question does. */
export const ReplyOnly: Story = {
  name: "Reply only",
  render: () => <Digest status={STATUS} asks={[CHANNEL]} />,
};

/** Two or more asks show one at a time, paged from the bottom section beside what the ask
    links: a dot per ask, the one on show a dash, between previous and next. */
export const SeveralAsks: Story = {
  name: "Several asks",
  render: () => <Digest status={STATUS} asks={[PUSH, CHANNEL, REVIEW]} />,
};

/** An ask about a pull request shows it, with its state, among the ask's links. */
export const PullRequestStates: Story = {
  name: "Pull request states",
  render: () => (
    <Stack gap={2}>
      {PULL_REQUEST_ASKS.map(([name, ask]) => (
        <Digest key={name} status={null} asks={[ask]} />
      ))}
    </Stack>
  ),
};

/** Dismissed asks are counted until "Show N dismissed" brings them back: in the bottom section
    while an ask is still on show, else on the status line. */
export const DismissedHidden: Story = {
  name: "Dismissed hidden",
  render: () => (
    <Stack gap={2}>
      <Digest status={STATUS} asks={[CHANNEL, PUSH, REVIEW]} dismissed={2} />
      <Digest status={STATUS} asks={[PUSH, CHANNEL, REVIEW]} dismissed={3} />
    </Stack>
  ),
};

/** A thread the digest can resolve, with just what its link chip and pull request read. */
function storyThread(
  id: string,
  title: string,
  fields: {
    readonly runtime?: "running" | "failed";
    readonly waitingOnYou?: boolean;
    readonly pullRequest?: { readonly number: number; readonly kind: PullRequestKind };
  } = {},
): EnvironmentThreadShell {
  const pullRequest = fields.pullRequest;
  return {
    id: ThreadId.make(id),
    environmentId,
    title,
    runtime: fields.runtime === undefined ? null : { status: fields.runtime },
    latestRun: null,
    hasPendingApprovals: false,
    hasPendingUserInput: fields.waitingOnYou === true,
    pendingBackgroundTasks: [],
    settledOverride: null,
    goal: null,
    lastVisitedAt: null,
    archivedAt: null,
    branchPullRequest: null,
    pullRequests:
      pullRequest === undefined
        ? []
        : [
            {
              url: `https://github.com/example/app/pull/${pullRequest.number}`,
              number: pullRequest.number,
              host: "github.com",
              repository: "example/app",
              source: "created",
              linkedAt: SYNCED_AT,
              stack: null,
              snapshot: {
                state: pullRequest.kind === "draft" ? "open" : pullRequest.kind,
                isDraft: pullRequest.kind === "draft",
                title,
                headBranch: "petal/story",
                baseBranch: "main",
                updatedAt: null,
                syncedAt: SYNCED_AT,
              },
            },
          ],
    source: { tags: [] },
  } as unknown as EnvironmentThreadShell;
}

const LINKED_THREADS = [
  storyThread("story-bumps", "Nightly dependency bumps", { runtime: "running" }),
  storyThread("story-copy", "Rewrite onboarding copy", { waitingOnYou: true }),
  storyThread("story-shards", "Retry flaky shards", {
    pullRequest: { number: 361, kind: "merged" },
  }),
  storyThread("story-manifest", "Refresh the model manifest", {
    pullRequest: { number: 362, kind: "draft" },
  }),
];

/** A card with nothing to page to. */
const ALONE = { paging: { at: 0, count: 1, onPage: noop }, hiddenCount: 0, onShowDismissed: noop };

interface LinkedAskSpec {
  readonly name: string;
  readonly question: string;
  readonly detail: string | null;
  readonly threads: ReadonlyArray<readonly [id: string, label: string]>;
  readonly pullRequests: ReadonlyArray<number>;
  readonly answers: ReadonlyArray<string>;
}

/** Asks as the digest parses them, resolved against the threads above by the app's own link
    resolution. */
const LINKED_ASKS: ReadonlyArray<LinkedAskSpec> = [
  {
    name: "A thread it is working in",
    question: "OK to push the dependency bumps and open a PR?",
    detail: "The web tests pass.",
    threads: [["story-bumps", "Nightly dependency bumps"]],
    pullRequests: [],
    answers: ["Open PR", "Hold"],
  },
  {
    name: "A thread waiting on you (Reply opens it)",
    question: "The onboarding thread asked which tone to use. Answer it there?",
    detail: null,
    threads: [["story-copy", "Rewrite onboarding copy"]],
    pullRequests: [],
    answers: [],
  },
  {
    name: "A pull request on its own",
    question: "Merge the docs link fix?",
    detail: "Checks pass.",
    threads: [],
    pullRequests: [340],
    answers: ["Merge", "Hold"],
  },
  {
    name: "A thread whose own pull request the line leaves out",
    question: "Delete the merged retry branch?",
    detail: null,
    threads: [["story-shards", "Retry flaky shards"]],
    pullRequests: [],
    answers: ["Delete branch", "Keep"],
  },
  {
    name: "A thread and the pull request it names",
    question: "Mark the manifest refresh ready for review?",
    detail: null,
    threads: [["story-manifest", "Refresh the model manifest"]],
    pullRequests: [362],
    answers: ["Mark ready", "Keep as draft"],
  },
  {
    name: "A thread this client cannot find",
    question: "Archive the old spike?",
    detail: null,
    threads: [["story-gone", "Old billing spike"]],
    pullRequests: [],
    answers: ["Archive", "Keep"],
  },
  {
    name: "Nothing linked (no bottom section)",
    question: "Pause tonight's wake?",
    detail: null,
    threads: [],
    pullRequests: [],
    answers: ["Pause", "Keep"],
  },
];

function LinkedAsk(props: { readonly spec: LinkedAskSpec }) {
  const { spec } = props;
  const text = spec.detail === null ? spec.question : `${spec.question} ${spec.detail}`;
  const item: DigestItem = {
    text,
    source: text,
    threads: spec.threads.map(([id, label]) => ({
      link: { environmentId, threadId: ThreadId.make(id) },
      label,
    })),
    pullRequests: spec.pullRequests.map((number) => ({
      url: `https://github.com/example/app/pull/${number}`,
      number,
    })),
    answers: spec.answers,
  };
  const line = resolveBotDigestLine(item, { shells: LINKED_THREADS }, environmentId);
  return (
    <StoryComposer
      prompt="Ask Release Petal"
      banners={
        <BotDigestAskCardView
          question={spec.question}
          detail={spec.detail}
          links={line.links}
          environmentId={environmentId}
          answers={spec.answers}
          bottom={ALONE}
          onDismiss={noop}
          onSend={noop}
          onReply={noop}
        />
      }
    />
  );
}

/** What an ask links, in its bottom section: a thread with the thread glyph and its title, a
    pull request with its state and number, a linked thread's own pull request even when the line
    leaves it out, and a thread this client cannot find as the glyph and the Petal's words. */
export const LinkedStates: Story = {
  name: "Linked states",
  render: () => (
    <Stack gap={4}>
      {LINKED_ASKS.map((spec) => (
        <div key={spec.name} className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">{spec.name}</p>
          <LinkedAsk spec={spec} />
        </div>
      ))}
    </Stack>
  ),
};

const WORK_QUESTION: PendingUserInput = {
  requestId: RuntimeRequestId.make("work-question"),
  createdAt: SYNCED_AT,
  responseCapability: "live",
  dismissible: false,
  questions: [
    {
      id: "tone",
      header: "Tone",
      question: "Which tone should the onboarding copy take?",
      multiSelect: false,
      options: [
        { label: "Warm", description: "Friendly, a little playful." },
        { label: "Plain", description: "Short and direct." },
      ],
    },
  ],
};

const WORK_APPROVAL: PendingApproval = {
  requestId: RuntimeRequestId.make("work-approval"),
  requestKind: "command",
  createdAt: SYNCED_AT,
  detail: "pnpm up --latest --filter web",
  responseCapability: "live",
};

type QuestionAnswers = ComponentProps<typeof ComposerPendingUserInputPanel>["answers"];

/** A work thread's question as the Petal shows it, picking locally. */
function WorkQuestion(props: {
  readonly paging: ComponentProps<typeof BotDigestBottom>["paging"];
}) {
  const [answers, setAnswers] = useState<QuestionAnswers>({});
  return (
    <ComposerBanner.Attachment>
      <ComposerBanner.Root data-chat-composer-top-drawer="true" variant="info">
        <ComposerPendingUserInputPanel
          pendingUserInputs={[WORK_QUESTION]}
          cwd={undefined}
          threadRef={{ environmentId, threadId: ThreadId.make("story-copy") }}
          respondingRequestIds={[]}
          answers={answers}
          questionIndex={0}
          onToggleOption={(questionId, value) =>
            setAnswers({ ...answers, [questionId]: { selectedOptionValues: [value] } })
          }
          onAdvance={noop}
          onPrevious={noop}
          onDismiss={noop}
          footer={
            <BotDigestBottom
              paging={props.paging}
              hiddenCount={0}
              onShowDismissed={noop}
              links={childLinks(LINKED_THREADS[1]!)}
              environmentId={environmentId}
            />
          }
        />
      </ComposerBanner.Root>
    </ComposerBanner.Attachment>
  );
}

/** A work thread's approval and question, paged with the digest's asks one card at a time: each
    is the thread's own card, naming the thread it came from, answered from the Petal. Shown here as
    the first two of three cards. */
export const WorkThreadRequests: Story = {
  name: "Work thread requests",
  render: () => (
    <Stack gap={4}>
      <StoryComposer
        prompt="Ask Release Petal"
        banners={
          <ComposerBannerStack
            items={[
              forkApprovalNoticeItem({
                approval: WORK_APPROVAL,
                pendingCount: 1,
                disabled: false,
                isResponding: false,
                onRespondToApproval: async () => {},
                source: (
                  <BotDigestBottomInline
                    paging={{ at: 0, count: 3, onPage: noop }}
                    hiddenCount={0}
                    onShowDismissed={noop}
                    links={childLinks(LINKED_THREADS[0]!)}
                    environmentId={environmentId}
                  />
                ),
              }),
            ]}
          />
        }
      />
      <StoryComposer
        prompt="Ask Release Petal"
        banners={<WorkQuestion paging={{ at: 1, count: 3, onPage: noop }} />}
      />
    </Stack>
  ),
};
