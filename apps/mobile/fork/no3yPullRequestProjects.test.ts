import {
  EnvironmentId,
  ProjectId,
  SourceControlProviderKind,
  type PullRequestListEntry,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  DEFAULT_PR_LIST_CONTROLS,
  filterPullRequestList,
  pullRequestListInput,
  pullRequestProjectChoices,
  withoutScratchProjectScope,
} from "../src/features/pull-requests/pullRequestList";
import { pullRequestViewMatches } from "../src/features/pull-requests/pullRequestSavedViews";
import {
  pullRequestProjectIdsByEnvironment,
  toggledPullRequestProject,
  withPullRequestProjectSet,
  type PullRequestProjectRef,
} from "./no3yPullRequestProjects";

const withProjects = (projects: ReadonlyArray<PullRequestProjectRef>) => ({
  ...DEFAULT_PR_LIST_CONTROLS,
  projects,
});

const laptop = EnvironmentId.make("env-laptop");
const desktop = EnvironmentId.make("env-desktop");
const web = { projectId: "web", environmentId: laptop };
const api = { projectId: "api", environmentId: laptop };
const docs = { projectId: "docs", environmentId: desktop };

function entry(number: number, projectId: string, environmentId: EnvironmentId) {
  const base: PullRequestListEntry = {
    number,
    provider: SourceControlProviderKind.make("github"),
    host: "github.com",
    repository: `org/${projectId}`,
    projectId: ProjectId.make(projectId),
    projectTitle: projectId,
    title: `Change ${number}`,
    url: `https://github.com/org/${projectId}/pull/${number}`,
    author: null,
    headBranch: `branch-${number}`,
    baseBranch: "main",
    state: "open",
    isDraft: false,
    mergeability: "unknown",
    additions: 0,
    deletions: 0,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    viewerReviewRequested: false,
    labels: [],
  };
  return { ...base, environmentId };
}

describe("pull request project selection", () => {
  it("loads a single saved project as a one-project set and drops the pair", () => {
    const legacy = { ...DEFAULT_PR_LIST_CONTROLS, projectId: "web", projectEnvironmentId: laptop };
    expect(withPullRequestProjectSet(legacy)).toEqual(withProjects([web]));
    expect(withPullRequestProjectSet({ ...withProjects([docs]), projectId: "web" })).toEqual(
      withProjects([docs]),
    );
    const current = withProjects([web]);
    expect(withPullRequestProjectSet(current)).toBe(current);
    expect(toggledPullRequestProject([web], docs)).toEqual([web, docs]);
    expect(toggledPullRequestProject([web], web)).toBeUndefined();
  });

  it("asks each environment only for its own selected projects and keeps rows from any of them", () => {
    const byEnvironment = pullRequestProjectIdsByEnvironment(withProjects([web, api, docs]));
    expect([...byEnvironment]).toEqual([
      [laptop, ["web", "api"]],
      [desktop, ["docs"]],
    ]);
    expect(pullRequestProjectIdsByEnvironment(DEFAULT_PR_LIST_CONTROLS).size).toBe(0);
    expect(
      pullRequestListInput(DEFAULT_PR_LIST_CONTROLS, "", byEnvironment.get(desktop)).projectIds,
    ).toEqual(["docs"]);

    const rows = [
      entry(1, "web", laptop),
      entry(2, "api", laptop),
      entry(3, "docs", laptop),
      entry(4, "docs", desktop),
      entry(5, "cli", laptop),
    ];
    const shown = (selection: ReadonlyArray<PullRequestProjectRef>) =>
      filterPullRequestList(rows, withProjects(selection), {}, "", new Set()).map(
        (row) => row.number,
      );
    expect(shown([web, docs]).sort()).toEqual([1, 4]);
    expect(shown([]).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("drops only scratch projects from a selection", () => {
    const controls = withProjects([web, docs]);
    const projects = [
      { id: "web", environmentId: laptop, isScratch: true as const },
      { id: "docs", environmentId: desktop },
    ];
    expect(withoutScratchProjectScope(controls, projects).projects).toEqual([docs]);
    expect(withoutScratchProjectScope(controls, [])).toBe(controls);
  });

  it("keeps every selected project in the menu, even a second checkout of one repository", () => {
    const project = (id: string) => ({
      id: ProjectId.make(id),
      environmentId: laptop,
      title: id,
      workspaceRoot: `/work/${id}`,
      repositoryIdentity: {
        canonicalKey: id === "docs" ? "github.com/org/docs" : "github.com/org/web",
      },
    });
    const choices = pullRequestProjectChoices(
      [project("docs"), project("web"), project("web-wt")],
      {
        environmentId: null,
        controls: withProjects([
          { projectId: "docs", environmentId: laptop },
          { projectId: "web-wt", environmentId: laptop },
        ]),
        environmentLabels: new Map(),
        servesPullRequests: () => true,
      },
    );
    expect(choices.map((choice) => choice.id).sort()).toEqual(["docs", "web-wt"]);
  });

  it("matches a saved view whatever order its projects were ticked in", () => {
    const view = (selection: ReadonlyArray<PullRequestProjectRef>) => ({
      environmentId: null,
      query: "",
      controls: withProjects(selection),
    });
    expect(pullRequestViewMatches(view([web, docs]), view([docs, web]))).toBe(true);
    expect(pullRequestViewMatches(view([web, docs]), view([web]))).toBe(false);
  });
});
