import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import {
  DEFAULT_CLIENT_SETTINGS,
  EnvironmentId,
  ProjectId,
  ThreadId,
  type ThreadPullRequestLink,
} from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import { render } from "../../test/render";

const environmentId = EnvironmentId.make("local");
const projectId = ProjectId.make("project-1");
const hostRef = scopeThreadRef(environmentId, ThreadId.make("sprint-host"));
const childRef = scopeThreadRef(environmentId, ThreadId.make("sprint-child"));

const project = {
  id: projectId,
  environmentId,
  workspaceRoot: "/repo",
  repositoryIdentity: {
    provider: "github" as const,
    canonicalKey: "github.com/noahhendrickson/no3ycode",
    displayName: "NoahHendrickson/no3ycode",
    locator: {
      source: "git-remote" as const,
      remoteName: "origin",
      remoteUrl: "https://github.com/NoahHendrickson/no3ycode.git",
    },
  },
};

function makeLink(
  number: number,
  title: string,
  headBranch: string,
  baseBranch: string,
): ThreadPullRequestLink {
  return {
    host: "github.com",
    repository: "NoahHendrickson/no3ycode",
    number,
    url: `https://github.com/NoahHendrickson/no3ycode/pull/${number}`,
    source: "created",
    linkedAt: "2026-11-27T20:00:00.000Z",
    stack: null,
    snapshot: {
      state: "open",
      title,
      headBranch,
      baseBranch,
      isDraft: false,
      additions: 12,
      deletions: 3,
      updatedAt: "2026-11-27T20:00:00.000Z",
      syncedAt: "2026-11-27T20:00:00.000Z",
    },
  };
}

const hostPr = makeLink(100, "Host sprint umbrella PR", "sprint-main", "custom");
const childBasePr = makeLink(201, "Child stack base PR", "feat-base", "custom");
const childTopPr = makeLink(202, "Child stack top PR", "feat-top", "feat-base");

const threadsByKey = new Map([
  [
    scopedThreadKey(hostRef),
    {
      id: hostRef.threadId,
      environmentId,
      projectId,
      title: "Sprint coordinator",
      branch: "sprint-main",
      worktreePath: null,
      lineage: {},
      pullRequests: [hostPr],
      issues: [],
    },
  ],
  [
    scopedThreadKey(childRef),
    {
      id: childRef.threadId,
      environmentId,
      projectId,
      title: "Embedded child thread",
      branch: "feat-top",
      worktreePath: null,
      lineage: {},
      pullRequests: [childBasePr, childTopPr],
      issues: [],
    },
  ],
]);

const serverConfig = {
  environment: {
    capabilities: {
      pullRequests: true,
      threadPullRequestLinks: true,
      threadPullRequestWatch: false,
      issues: false,
    },
  },
};
const serverConfigs = new Map([[environmentId, serverConfig]]);

vi.mock("../state/entities", async (original) => ({
  ...(await original<typeof import("../state/entities")>()),
  readProjects: () => [project],
  useProjects: () => [project],
  readProject: () => project,
  readThreadShell: (ref: { environmentId: EnvironmentId; threadId: ThreadId } | null) =>
    ref ? (threadsByKey.get(scopedThreadKey(ref)) ?? null) : null,
  useThreadShell: (ref: { environmentId: EnvironmentId; threadId: ThreadId } | null) =>
    ref ? (threadsByKey.get(scopedThreadKey(ref)) ?? null) : null,
  useQuietThreadShell: (ref: { environmentId: EnvironmentId; threadId: ThreadId } | null) =>
    ref ? (threadsByKey.get(scopedThreadKey(ref)) ?? null) : null,
  useServerConfigs: () => serverConfigs,
}));

vi.mock("../state/server", async (original) => {
  const { Atom } = await import("effect/reactivity");
  return {
    ...(await original<typeof import("../state/server")>()),
    environmentServerConfigsAtom: Atom.make(
      new Map([
        [
          "local",
          {
            environment: {
              capabilities: {
                pullRequests: true,
                threadPullRequestLinks: true,
                threadPullRequestWatch: false,
                issues: false,
              },
            },
          },
        ],
      ]),
    ),
  };
});

vi.mock("../state/environments", async (original) => ({
  ...(await original<typeof import("../state/environments")>()),
  usePrimaryEnvironmentId: () => environmentId,
}));

vi.mock("../state/query", async (original) => ({
  ...(await original<typeof import("../state/query")>()),
  useEnvironmentQuery: () => ({ data: null, isLoading: false }),
}));

vi.mock("../state/use-atom-command", () => ({
  useAtomCommand: () => vi.fn(),
}));

vi.mock("../state/use-atom-query-runner", () => ({
  useAtomQueryRunner: () => vi.fn(),
}));

vi.mock("../browser/useOpenLink", () => ({
  useOpenLink: () => vi.fn(),
}));

import { ThreadPullRequestsPanel } from "../components/pullRequest/ThreadPullRequestsPanel";
import { __setClientSettingsForTests } from "../hooks/useSettings";
import {
  hostRightPanel,
  pullRequestSurfaceId,
  selectActiveRightPanelSurface,
  useRightPanelStore,
} from "../rightPanelStore";
import { AppAtomRegistryProvider } from "../rpc/atomRegistry";
import { ComposerPullRequestChip } from "./ComposerPullRequestChip";

function setup() {
  __setClientSettingsForTests({
    ...DEFAULT_CLIENT_SETTINGS,
    pullRequestLinksOpenInApp: true,
  });
  useRightPanelStore.setState({
    byThreadKey: {},
    threadPanelVisibilityByThreadKey: {},
    userActionRevisionByThreadKey: {},
    closeRevisionByThreadKey: {},
  });
}

describe("embedded child PR list", () => {
  it("opens the embedded child's PR list in the host panel and opens clicked PRs there even after unhosting", async () => {
    setup();
    const unhost = hostRightPanel(childRef, hostRef);
    let surface: ReturnType<typeof selectActiveRightPanelSurface> = null;
    try {
      await using chipScreen = await render(
        <AppAtomRegistryProvider>
          <ComposerPullRequestChip threadRef={childRef} branch="feat-top" cwd={null} />
        </AppAtomRegistryProvider>,
      );

      const chip = chipScreen.getByRole("button");
      await expect.element(chip).toBeVisible();
      await userEvent.click(chip);

      surface = selectActiveRightPanelSurface(useRightPanelStore.getState().byThreadKey, hostRef);
      expect(surface).toEqual({
        id: `pull-requests:${scopedThreadKey(childRef)}`,
        kind: "pull-requests",
        threadRef: childRef,
      });
    } finally {
      unhost();
    }

    // Even after the embedded child unmounts/unhosts, rendering the panel for that surface shows
    // the child's stack (not the host's PR) and opens clicked PRs in the host panel.
    expect(surface?.kind).toBe("pull-requests");
    const listThreadRef =
      surface?.kind === "pull-requests" ? (surface.threadRef ?? hostRef) : hostRef;
    await using panelScreen = await render(
      <AppAtomRegistryProvider>
        <div style={{ display: "flex", flexDirection: "column", height: 480, width: 360 }}>
          <ThreadPullRequestsPanel threadRef={listThreadRef} panelRef={hostRef} />
        </div>
      </AppAtomRegistryProvider>,
    );

    await expect.element(panelScreen.getByText("Child stack base PR")).toBeVisible();
    await expect.element(panelScreen.getByText("Child stack top PR")).toBeVisible();
    expect(panelScreen.container.textContent).not.toContain("Host sprint umbrella PR");

    await userEvent.click(panelScreen.getByText("Child stack top PR"));
    expect(
      selectActiveRightPanelSurface(useRightPanelStore.getState().byThreadKey, hostRef)?.id,
    ).toBe(
      pullRequestSurfaceId({
        projectId,
        host: "github.com",
        repository: "noahhendrickson/no3ycode",
        number: 202,
      }),
    );
  });

  it("keeps normal threads listing their own PRs and opening them in their own panel", async () => {
    setup();
    useRightPanelStore.getState().open(hostRef, "pull-requests");
    const surface = selectActiveRightPanelSurface(
      useRightPanelStore.getState().byThreadKey,
      hostRef,
    );
    expect(surface).toEqual({ id: "pull-requests", kind: "pull-requests" });

    const listThreadRef =
      surface?.kind === "pull-requests" ? (surface.threadRef ?? hostRef) : hostRef;
    await using panelScreen = await render(
      <AppAtomRegistryProvider>
        <div style={{ display: "flex", flexDirection: "column", height: 480, width: 360 }}>
          <ThreadPullRequestsPanel threadRef={listThreadRef} panelRef={hostRef} />
        </div>
      </AppAtomRegistryProvider>,
    );

    await expect.element(panelScreen.getByText("Host sprint umbrella PR")).toBeVisible();
    expect(panelScreen.container.textContent).not.toContain("Child stack base PR");

    await userEvent.click(panelScreen.getByText("Host sprint umbrella PR"));
    expect(
      selectActiveRightPanelSurface(useRightPanelStore.getState().byThreadKey, hostRef)?.id,
    ).toBe(
      pullRequestSurfaceId({
        projectId,
        host: "github.com",
        repository: "noahhendrickson/no3ycode",
        number: 100,
      }),
    );
  });
});
