import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  EnvironmentId,
  MessageId,
  type OrchestrationV2ConversationMessage,
  type OrchestrationV2Run,
  ProviderInstanceId,
  RunId,
  RuntimeRequestId,
  ThreadId,
} from "@t3tools/contracts";
import { type ComponentProps, type ReactNode, useState } from "react";

import { ComposerBanner } from "~/components/chat/ComposerBanner";
import { ComposerBannerStack } from "~/components/chat/ComposerBannerStack";
import { ComposerPendingUserInputPanel } from "~/components/chat/ComposerPendingUserInputPanel";
import { branchMismatchBannerItem } from "~/components/chat/ThreadActivityBanners";
import { usageLimitRecoveryBannerItem } from "~/components/chat/UsageLimitRecoveryBanner";
import { ComposerQueuedChip } from "~/custom/ComposerQueuedChip";
import { forkApprovalNoticeItem } from "~/custom/forkApprovalNotice";
import { ForkQueuedRunsBanner } from "~/custom/ForkQueuedRunsBanner";
import { useResumeCompactionBanner } from "~/custom/useResumeCompactionBanner";
import { useThreadStateBanners } from "~/custom/useThreadStateBanners";
import { AppAtomRegistryProvider, appAtomRegistry } from "~/rpc/atomRegistry";
import type { PendingApproval, PendingUserInput } from "~/session-logic";
import { environmentThreadDetails } from "~/state/threads";
import { makeThreadProjectionFixture } from "~/test-fixtures";

import { Stack } from "../Specimen.tsx";
import { StoryComposer } from "../StoryComposer.tsx";

// Every card mounts where ChatComposer mounts it: ComposerShell's banner dock, in the overlay and
// form the thread composer sits in, so the theme sheets reach it as they do in the app.

const environmentId = EnvironmentId.make("story");
const threadId = ThreadId.make("thread-story");
const threadRef = { environmentId, threadId };
const noop = () => {};
const respond = async () => {};
const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

/** The composer with `banners` in its dock, at the chat column's width. */
function Composer(props: { banners?: ReactNode; statusChips?: ReactNode }) {
  return (
    <div className="w-[736px] max-w-full">
      <StoryComposer
        prompt="Ask anything"
        banners={props.banners}
        statusChips={props.statusChips}
      />
    </div>
  );
}

/** ChatComposer's notice stack: each item its own attached card, joined to the next. */
const RUN = RunId.make("run-story");

function usageLimit(errorCode: string | null, scheduled: boolean) {
  const resetAt = minutesFromNow(95);
  return usageLimitRecoveryBannerItem({
    runId: RUN,
    errorCode,
    resetAt,
    stoppedAt: new Date().toISOString(),
    settled: false,
    requestPending: false,
    snoozedUntil: null,
    recovery: scheduled ? { runId: RUN, resetAt, autoResume: true } : null,
    timestampFormat: "locale",
    onChange: respond,
  });
}

const BRANCH_MISMATCH = branchMismatchBannerItem({
  mismatchKey: "story",
  mismatch: { threadBranch: "t3/composer-banner-cards", currentBranch: "custom" },
  restoreDisabled: false,
  restoring: false,
  onRestore: noop,
  onDismiss: noop,
});

/** The settled, snoozed and woke cards come from the hook ChatView calls. */
function ThreadStateNotice({ state }: { state: "settled" | "snoozed" | "woke" }) {
  const { woke, parked } = useThreadStateBanners({
    threadId,
    settled: state === "settled",
    snoozed: state === "snoozed",
    wokeVisible: state === "woke",
    canOperateThread: true,
    isUnsnoozing: false,
    isUnsettling: false,
    onUnsnooze: noop,
    onUnsettle: noop,
    onAcknowledgeWoke: noop,
  });
  const item = woke ?? parked;
  return <Composer banners={item ? <ComposerBannerStack items={[item]} /> : null} />;
}

const compactRef = { current: { compactContext: noop } };

/** A stale, large Claude thread offers Compact; the hook decides when, as ChatView's does. */
function ResumeCompactionNotice({
  compactDisabledReason,
}: {
  compactDisabledReason: string | null;
}) {
  const [now] = useState(() => new Date());
  const item = useResumeCompactionBanner({
    threadId: `${threadId}:${compactDisabledReason ?? "enabled"}`,
    contextWindow: {
      usedTokens: 412_000,
      updatedAt: new Date(now.getTime() - 3 * 60 * 60_000).toISOString(),
    },
    dismissed: false,
    hidden: false,
    provider: "claudeAgent",
    nowMinute: now.toISOString().slice(0, 16),
    compactDisabledReason,
    composerRef: compactRef,
  });
  return <Composer banners={item ? <ComposerBannerStack items={[item]} /> : null} />;
}

const APPROVALS = {
  command: {
    requestId: RuntimeRequestId.make("approval-command"),
    requestKind: "command",
    createdAt: new Date().toISOString(),
    detail: "vp run typecheck --filter @t3tools/web",
    responseCapability: "live",
  },
  fileChange: {
    requestId: RuntimeRequestId.make("approval-file-change"),
    requestKind: "file-change",
    createdAt: new Date().toISOString(),
    detail: "apps/web/src/theme.custom.thread-composer.css",
    reason: "Rounds the banner cards to the composer's 12px corners.",
    responseCapability: "live",
  },
  app: {
    requestId: RuntimeRequestId.make("approval-app"),
    requestKind: "mcp-elicitation",
    createdAt: new Date().toISOString(),
    appName: "Figma",
    detail: "Read the frames on the Composer page of the Basic UI kit.",
    fullAccessOverride: "ask_rule",
    responseCapability: "live",
  },
  gone: {
    requestId: RuntimeRequestId.make("approval-gone"),
    requestKind: "command",
    createdAt: new Date().toISOString(),
    detail: "git push origin t3/composer-banner-cards",
    responseCapability: "not_resumable",
  },
} satisfies Record<string, PendingApproval>;

function approval(item: PendingApproval, pendingCount = 1, isResponding = false) {
  return forkApprovalNoticeItem({
    approval: item,
    pendingCount,
    disabled: false,
    isResponding,
    onRespondToApproval: respond,
  });
}

const QUESTION_SINGLE: PendingUserInput = {
  requestId: RuntimeRequestId.make("question-single"),
  createdAt: new Date().toISOString(),
  responseCapability: "live",
  dismissible: false,
  questions: [
    {
      id: "radius",
      header: "Radius",
      question: "Which corner radius should the banner cards use under **Flat Glass**?",
      multiSelect: false,
      options: [
        { label: "12px", description: "Match the prompt surface's corners." },
        { label: "16px", description: "Keep upstream's 16px corners." },
        { label: "8px", description: "Match the vessel's old corners." },
      ],
    },
  ],
};

const QUESTION_MULTI: PendingUserInput = {
  requestId: RuntimeRequestId.make("question-multi"),
  createdAt: new Date().toISOString(),
  responseCapability: "live",
  dismissible: true,
  questions: [
    {
      id: "themes",
      header: "Themes",
      question: "Which themes should the refactor cover?",
      multiSelect: true,
      options: [
        { label: "Flat Glass", description: "The primary theme." },
        { label: "Basic", description: "Every tone." },
        { label: "Inlet", description: "Every colour." },
      ],
    },
    {
      id: "ship",
      header: "Ship",
      question: "Ship it as one PR?",
      multiSelect: false,
      options: [
        { label: "Yes", description: "One PR for every card." },
        { label: "No", description: "One PR per card." },
      ],
    },
  ],
};

type Answers = ComponentProps<typeof ComposerPendingUserInputPanel>["answers"];

/** The card in ChatComposer's top drawer, answering and paging locally. */
function Question(props: {
  prompt: PendingUserInput;
  initialAnswers?: Answers;
  initialIndex?: number;
  isResponding?: boolean;
  disabled?: boolean;
}) {
  const [answers, setAnswers] = useState<Answers>(props.initialAnswers ?? {});
  const [index, setIndex] = useState(props.initialIndex ?? 0);
  const toggle = (questionId: string, value: string) => {
    const question = props.prompt.questions.find((candidate) => candidate.id === questionId);
    const selected = answers[questionId]?.selectedOptionValues ?? [];
    const next = question?.multiSelect
      ? selected.includes(value)
        ? selected.filter((candidate) => candidate !== value)
        : [...selected, value]
      : [value];
    setAnswers({ ...answers, [questionId]: { selectedOptionValues: next } });
  };
  return (
    <ComposerBanner.Attachment>
      <ComposerBanner.Root data-chat-composer-top-drawer="true" variant="info">
        <ComposerPendingUserInputPanel
          pendingUserInputs={[props.prompt]}
          cwd={undefined}
          threadRef={threadRef}
          disabled={props.disabled ?? false}
          respondingRequestIds={props.isResponding ? [props.prompt.requestId] : []}
          answers={answers}
          questionIndex={index}
          onToggleOption={toggle}
          onAdvance={() => setIndex(Math.min(index + 1, props.prompt.questions.length - 1))}
          onPrevious={() => setIndex(Math.max(index - 1, 0))}
          onDismiss={noop}
        />
      </ComposerBanner.Root>
    </ComposerBanner.Attachment>
  );
}

const queuedThreadId = ThreadId.make("thread-story-queue");
const QUEUED_TEXTS = [
  "Then run the Storybook pass in all three themes and screenshot each card.",
  "After that, diff the computed styles of every banner card before and after the CSS refactor, including the pseudo-elements that paint the surface and the seam, and list anything that moved.",
  "Open the PR when it's green.",
];

/** A thread with three queued runs and nothing running, so each row offers Send now. */
function queuedProjection() {
  const base = makeThreadProjectionFixture();
  const at = base.thread.createdAt;
  const providerInstanceId = ProviderInstanceId.make("claudeAgent");
  const runs = QUEUED_TEXTS.map((_, index): OrchestrationV2Run => ({
    id: RunId.make(`run-queued-${index + 1}`),
    threadId: queuedThreadId,
    ordinal: index + 1,
    providerInstanceId,
    modelSelection: { instanceId: providerInstanceId, model: "claude-opus-5-5" },
    providerThreadId: null,
    userMessageId: MessageId.make(`message-queued-${index + 1}`),
    rootNodeId: null,
    activeAttemptId: null,
    status: "queued",
    queuePosition: index + 1,
    requestedAt: at,
    startedAt: null,
    completedAt: null,
    checkpointId: null,
    contextHandoffId: null,
  }));
  const messages = QUEUED_TEXTS.map((text, index): OrchestrationV2ConversationMessage => ({
    id: MessageId.make(`message-queued-${index + 1}`),
    threadId: queuedThreadId,
    runId: RunId.make(`run-queued-${index + 1}`),
    nodeId: null,
    role: "user",
    text,
    attachments: [],
    streaming: false,
    createdBy: "user",
    creationSource: "web",
    createdAt: at,
    updatedAt: at,
  }));
  return {
    ...base,
    thread: { ...base.thread, id: queuedThreadId, title: "Composer cards" },
    runs,
    messages,
  };
}

let queueSeeded = false;

/** The card reads the thread from the atom registry; this seeds it once, without a server. */
function seedQueue() {
  if (queueSeeded) return;
  queueSeeded = true;
  const atom = environmentThreadDetails.threadAtom({ environmentId, threadId: queuedThreadId });
  appAtomRegistry
    .ensureNode(atom)
    .setInitialValue({ environmentId, projection: queuedProjection() });
  appAtomRegistry.mount(atom);
}

function QueuedRuns({ editing = false }: { editing?: boolean }) {
  seedQueue();
  const [expanded, setExpanded] = useState(true);
  const card = (
    <AppAtomRegistryProvider>
      <ForkQueuedRunsBanner
        environmentId={environmentId}
        threadId={queuedThreadId}
        optimisticMessages={[]}
        editingRunId={editing ? RunId.make("run-queued-3") : null}
        editBlockedReason={null}
        onEditQueuedRun={noop}
        onCancelEdit={noop}
        expanded={expanded}
        onExpandedChange={setExpanded}
        steerShortcutLabel="⌘↵"
        editShortcutLabel="↑"
      />
    </AppAtomRegistryProvider>
  );
  return (
    <Composer
      banners={card}
      statusChips={
        expanded ? null : (
          <ComposerQueuedChip count={QUEUED_TEXTS.length} onExpand={() => setExpanded(true)} />
        )
      }
    />
  );
}

const meta = {
  title: "Fork/Composer cards",
  component: Composer,
  tags: ["autodocs"],
  // The question's markdown reads the router.
  parameters: { surface: "composer", router: true, controls: { disable: true } },
} satisfies Meta<typeof Composer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Notice cards: a title, an optional line under it, and their actions, in ChatComposer's stack.
    The usage limit card schedules a resume; ChatGPT's limit adds OpenAI's own action. */
export const NoticeCards: Story = {
  name: "Notices",
  render: () => (
    <Stack gap={4}>
      <Composer banners={<ComposerBannerStack items={[usageLimit(null, false)]} />} />
      <Composer banners={<ComposerBannerStack items={[usageLimit(null, true)]} />} />
      <Composer
        banners={
          <ComposerBannerStack
            items={[usageLimit("subscription_sharing_usage_limit_exceeded", false)]}
          />
        }
      />
      <Composer banners={<ComposerBannerStack items={[BRANCH_MISMATCH]} />} />
      <ResumeCompactionNotice compactDisabledReason={null} />
      <ResumeCompactionNotice compactDisabledReason="The thread is running" />
    </Stack>
  ),
};

/** The thread's state as a card: settled and snoozed offer the way back; a woken thread says so
    until it is dismissed or sent to. */
export const ThreadState: Story = {
  name: "Thread state",
  render: () => (
    <Stack gap={4}>
      <ThreadStateNotice state="settled" />
      <ThreadStateNotice state="snoozed" />
      <ThreadStateNotice state="woke" />
    </Stack>
  ),
};

/** A pending approval is a warning notice with Approve first. Several pending count 1/n; an app
    request names the app and can explain why full access still asks; a request whose provider
    process is gone cannot be answered. */
export const Approval: Story = {
  render: () => (
    <Stack gap={4}>
      <Composer banners={<ComposerBannerStack items={[approval(APPROVALS.command)]} />} />
      <Composer banners={<ComposerBannerStack items={[approval(APPROVALS.fileChange, 3)]} />} />
      <Composer banners={<ComposerBannerStack items={[approval(APPROVALS.app)]} />} />
      <Composer banners={<ComposerBannerStack items={[approval(APPROVALS.gone)]} />} />
      <Composer banners={<ComposerBannerStack items={[approval(APPROVALS.command, 1, true)]} />} />
    </Stack>
  ),
};

/** The question card: the question heads it, then its options, then Submit (or Next and
    Previous across several). Picking an option never submits. */
export const QuestionCard: Story = {
  name: "Question",
  render: () => (
    <Stack gap={4}>
      <Composer banners={<Question prompt={QUESTION_SINGLE} />} />
      <Composer
        banners={
          <Question
            prompt={QUESTION_SINGLE}
            initialAnswers={{ radius: { selectedOptionValues: ["12px"] } }}
          />
        }
      />
      <Composer
        banners={
          <Question
            prompt={QUESTION_MULTI}
            initialAnswers={{
              themes: { selectedOptionValues: ["Flat Glass", "Inlet"] },
              ship: { selectedOptionValues: ["Yes"] },
            }}
            initialIndex={1}
          />
        }
      />
      <Composer banners={<Question prompt={QUESTION_SINGLE} disabled />} />
    </Stack>
  ),
};

/** Queued messages: the card lists them with steer, edit, stash and remove, and the grip
    reorders them. Its header folds it into the Queued chip above the composer, which opens it
    again. The second shows the last message being edited in the composer. */
export const Queued: Story = {
  render: () => (
    <Stack gap={4}>
      <QueuedRuns />
      <QueuedRuns editing />
      <Composer statusChips={<ComposerQueuedChip count={3} onExpand={noop} />} />
    </Stack>
  ),
};

/** Cards stack in ChatComposer's order, each joined to the next, the last to the composer: the
    notices (machine first), then the queue, then the question. */
export const Stacked: Story = {
  render: () => {
    seedQueue();
    return (
      <Composer
        banners={
          <>
            <ComposerBannerStack
              items={[usageLimit(null, false), approval(APPROVALS.command, 2)]}
            />
            <AppAtomRegistryProvider>
              <ForkQueuedRunsBanner
                environmentId={environmentId}
                threadId={queuedThreadId}
                optimisticMessages={[]}
                editingRunId={null}
                editBlockedReason={null}
                onEditQueuedRun={noop}
                onCancelEdit={noop}
                expanded
                onExpandedChange={noop}
              />
            </AppAtomRegistryProvider>
            <Question prompt={QUESTION_SINGLE} />
          </>
        }
      />
    );
  },
};
