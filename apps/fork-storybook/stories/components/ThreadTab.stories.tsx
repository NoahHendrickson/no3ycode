import type { Meta, StoryObj } from "@storybook/react-vite";

import type { ProjectFaviconProject } from "~/components/ProjectFavicon";
import { ThreadTab } from "~/custom/CollapsedThreadTabs";
import { resolveSidebarV2CardStatus } from "~/custom/sidebarV2CardStatus";
import type { ProviderInstanceEntry } from "~/providerInstances";
import type { SidebarThreadSummary } from "~/types";

import { forceHoverStyles } from "../forcedHover.ts";

type Shell = SidebarThreadSummary;

const AT = "2026-11-11T15:00:00.000Z";
const EARLIER = "2026-11-11T14:00:00.000Z";

const PROJECTS = {
  no3ycode: { text: "N3", color: "emerald" },
  portfolio: { text: "PF", color: "violet" },
  "shaders-lab": { text: "SL", color: "amber" },
} as const;
type ProjectKey = keyof typeof PROJECTS;

const projectOf = (key: ProjectKey): ProjectFaviconProject => ({
  environmentId: "local" as ProjectFaviconProject["environmentId"],
  workspaceRoot: `/Users/noey/Developer/${key}`,
  title: key,
  faviconPath: null,
  projectIcon: { kind: "monogram", ...PROJECTS[key] },
});

const providerOf = (driver: "claudeAgent" | "codex", displayName: string) =>
  ({
    instanceId: driver as ProviderInstanceEntry["instanceId"],
    driverKind: driver,
    displayName,
    enabled: true,
    installed: true,
    status: "ready",
    isDefault: false,
    isAvailable: true,
    snapshot: {},
    models: [],
  }) as unknown as ProviderInstanceEntry;

const PROVIDERS = {
  claude: providerOf("claudeAgent", "Claude"),
  codex: providerOf("codex", "Codex"),
  none: null,
} as const;
type ProviderKey = keyof typeof PROVIDERS;

// What each status needs on the shell; the tab's mark comes from the app's own resolver.
const STATES = {
  idle: {},
  working: {
    runtime: {
      status: "running",
      activeRunId: "run-1",
      providerInstanceId: "claudeAgent",
      providerName: null,
      lastError: null,
      updatedAt: AT,
    },
  },
  input: { hasPendingUserInput: true },
  approval: { hasPendingApprovals: true },
  done: {
    lastVisitedAt: EARLIER,
    latestRun: {
      runId: "run-1",
      status: "completed",
      requestedAt: EARLIER,
      startedAt: EARLIER,
      completedAt: AT,
      assistantMessageId: null,
    },
  },
  failed: {
    runtime: {
      status: "failed",
      activeRunId: null,
      providerInstanceId: "claudeAgent",
      providerName: null,
      lastError: "Provider exited",
      updatedAt: AT,
    },
  },
} as const;
type StateKey = keyof typeof STATES;

const threadOf = (id: string, title: string, project: ProjectKey, state: StateKey): Shell =>
  ({
    environmentId: "local",
    id,
    projectId: project,
    title,
    providerInstanceId: "claudeAgent",
    branch: null,
    worktreePath: null,
    linkOrigin: null,
    delegatedFrom: null,
    activeProviderThreadId: null,
    latestRun: null,
    runtime: null,
    latestUserMessageAt: EARLIER,
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    hasActionableProposedPlan: false,
    pendingBackgroundTasks: [],
    providerInstanceHistory: [],
    goal: null,
    itemCount: 12,
    visibleItemCount: 12,
    createdAt: EARLIER,
    updatedAt: AT,
    archivedAt: null,
    settledOverride: null,
    settledAt: null,
    unsettledAt: null,
    snoozedUntil: null,
    snoozedAt: null,
    pinnedAt: null,
    pinOrderKey: null,
    activeOrderKey: null,
    pullRequests: [],
    lastVisitedAt: AT,
    deletedAt: null,
    ...STATES[state],
  }) as unknown as Shell;

interface TabArgs {
  readonly title: string;
  readonly state: StateKey;
  readonly active: boolean;
  readonly provider: ProviderKey;
  readonly project: ProjectKey | "none";
}

/** The tab as CollapsedThreadTabs renders it, from a thread in the given state. */
function Tab({ title, state, active, provider, project }: TabArgs) {
  const thread = threadOf(
    `thread-${title}`,
    title,
    project === "none" ? "no3ycode" : project,
    state,
  );
  return (
    <ThreadTab
      tab={{
        thread,
        // scopedThreadKey's form, environment:thread; the package has no client-runtime dependency.
        threadKey: `${thread.environmentId}:${thread.id}`,
        projectKey: project === "none" ? null : project,
      }}
      active={active}
      routed={active}
      status={
        resolveSidebarV2CardStatus(thread, {
          lastVisitedAt: thread.lastVisitedAt ?? undefined,
          wokeAt: null,
        }).topStatus
      }
      provider={PROVIDERS[provider]}
      project={project === "none" ? null : projectOf(project)}
      pullRequestsInRightPanel={false}
      canSettle={false}
      splitDraggable={false}
      onOpen={() => {}}
    />
  );
}

const meta = {
  title: "Components/Thread tab",
  component: Tab,
  tags: ["autodocs"],
  args: {
    title: "Storybook thread cards",
    state: "working",
    active: false,
    provider: "claude",
    project: "no3ycode",
  },
  argTypes: {
    state: { control: "inline-radio", options: Object.keys(STATES) },
    provider: { control: "inline-radio", options: Object.keys(PROVIDERS) },
    project: { control: "inline-radio", options: [...Object.keys(PROJECTS), "none"] },
  },
  parameters: {
    surface: "tabs",
    docs: {
      story: { iframeHeight: 160 },
      description: {
        component:
          "A thread as a tab in the collapsed sidebar's strip (`ThreadTab` in `custom/CollapsedThreadTabs.tsx`): the provider's mark in a cutout, the project, the title, and the status mark at the end. The open thread's tab takes the panel's face and joins the panel below through a concave corner either side, as a browser tab is its page. Hover shows the thread actions over the title's end.",
      },
    },
  },
} satisfies Meta<typeof Tab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The open thread's tab, joined to its pane. */
export const Open: Story = { args: { active: true } };

/** Every status the tab's end mark shows, from the thread's own state. */
export const Statuses: Story = {
  render: (args) => (
    <>
      {(Object.keys(STATES) as StateKey[]).map((state) => (
        <Tab key={state} {...args} state={state} title={state[0]!.toUpperCase() + state.slice(1)} />
      ))}
    </>
  ),
};

const COLUMNS = [
  { label: "Not selected", active: false, hover: false },
  { label: "Hovered", active: false, hover: true },
  { label: "Selected", active: true, hover: false },
  { label: "Selected, hovered", active: true, hover: true },
] as const;

/** A tab held in its hover state (forcedHover.ts), as if the pointer rested on it. */
function HoveredTab(props: TabArgs) {
  return (
    <div
      className="contents"
      ref={(cell) => {
        forceHoverStyles();
        cell?.querySelector("[data-fork-thread-tab]")?.setAttribute("data-story-hover", "");
      }}
    >
      <Tab {...props} />
    </div>
  );
}

/** Each status not selected, hovered and selected, off the strip. The tab-strip marker stays on
    the grid, so the tabs keep the strip's inks; a selected tab's neck hangs into empty frame. */
export const States: Story = {
  parameters: { surface: "frame", docs: { story: { iframeHeight: 420 } } },
  render: (args) => (
    <div
      data-fork-thread-tabs=""
      className="grid grid-cols-[auto_repeat(4,13rem)] items-center gap-x-12 gap-y-9"
    >
      <span />
      {COLUMNS.map((column) => (
        <span key={column.label} className="text-xs text-muted-foreground">
          {column.label}
        </span>
      ))}
      {(Object.keys(STATES) as StateKey[]).map((state) => {
        const name = state[0]!.toUpperCase() + state.slice(1);
        return [
          <span key={state} className="text-xs text-muted-foreground">
            {name}
          </span>,
          ...COLUMNS.map((column) => {
            const props = { ...args, state, active: column.active };
            return (
              <div key={`${state}-${column.label}`} className="flex">
                {column.hover ? <HoveredTab {...props} /> : <Tab {...props} />}
              </div>
            );
          }),
        ];
      })}
    </div>
  ),
};

/** A strip as the app lays it out: the open thread among the others. */
export const Strip: Story = {
  render: () => (
    <>
      <Tab
        title="Sidebar thread cards in Storybook"
        state="working"
        active
        provider="claude"
        project="no3ycode"
      />
      <Tab
        title="Hero video easing"
        state="input"
        active={false}
        provider="codex"
        project="portfolio"
      />
      <Tab
        title="Dither shader bake"
        state="done"
        active={false}
        provider="claude"
        project="shaders-lab"
      />
      <Tab
        title="Release smoke pins"
        state="approval"
        active={false}
        provider="codex"
        project="no3ycode"
      />
    </>
  ),
};

/** A long title truncates at the tab's maximum width. */
export const LongTitle: Story = {
  name: "Long title",
  args: {
    title: "Investigate why the release smoke check re-resolves patched dependency ranges",
  },
};
