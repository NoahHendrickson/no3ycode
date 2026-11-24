import { EnvironmentId, ProjectId, SourceControlProviderKind } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  deriveLaunchpadSuggestions,
  type LaunchpadGitStatus,
  type LaunchpadPullRequest,
} from "./draftLaunchpadSuggestions";

const environmentId = EnvironmentId.make("environment-test");

function pr(number: number, overrides: Partial<LaunchpadPullRequest> = {}): LaunchpadPullRequest {
  return {
    environmentId,
    provider: SourceControlProviderKind.make("github"),
    host: "github.com",
    projectId: ProjectId.make("project-a"),
    projectTitle: "a",
    repository: "owner/a",
    number,
    title: `PR ${number}`,
    url: `https://github.com/owner/a/pull/${number}`,
    author: null,
    headBranch: `branch-${number}`,
    baseBranch: "main",
    state: "open",
    isDraft: false,
    mergeability: "mergeable",
    additions: 0,
    deletions: 0,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    viewerReviewRequested: false,
    labels: [],
    ...overrides,
  };
}

const cleanGit: LaunchpadGitStatus = {
  refName: "main",
  isDefaultRef: true,
  hasPrimaryRemote: true,
  changedFileCount: 0,
  hasUpstream: true,
  behindCount: 0,
  aheadOfDefaultCount: 0,
  hasOpenPullRequest: false,
};

const kinds = (input: Parameters<typeof deriveLaunchpadSuggestions>[0]) =>
  deriveLaunchpadSuggestions(input).map((suggestion) => `${suggestion.kind}:${suggestion.id}`);

describe("deriveLaunchpadSuggestions", () => {
  it("offers one fix per authored pull request, worst first, ahead of reviews", () => {
    expect(
      kinds({
        authored: [
          pr(1, { reviewDecision: "approved", checksState: "passing" }),
          pr(2, { mergeability: "conflicting", checksState: "failing" }),
          pr(3, { reviewDecision: "changes-requested" }),
          pr(4, { checksState: "pending" }),
        ],
        reviewing: [pr(5, { viewerReviewRequested: true })],
        checkouts: [],
      }),
    ).toEqual([
      "conflicts:conflicts:https://github.com/owner/a/pull/2",
      "changes:changes:https://github.com/owner/a/pull/3",
      "review:review:https://github.com/owner/a/pull/5",
      "review-open:review-open:environment-test:project-a",
    ]);
  });

  it("offers each pull request once, even when two machines list it", () => {
    expect(
      kinds({
        authored: [
          pr(1, { checksState: "failing" }),
          pr(1, { checksState: "failing", environmentId: EnvironmentId.make("environment-two") }),
        ],
        reviewing: [
          pr(1, { viewerReviewRequested: true }),
          pr(2, { viewerReviewRequested: false }),
          pr(3, { viewerReviewRequested: true, state: "merged" }),
        ],
        checkouts: [],
      }),
    ).toEqual([
      "checks:checks:https://github.com/owner/a/pull/1",
      "review-open:review-open:environment-test:project-a",
    ]);
  });

  it("never offers to merge a draft", () => {
    expect(
      kinds({
        authored: [pr(1, { isDraft: true, reviewDecision: "approved", checksState: "passing" })],
        reviewing: [],
        checkouts: [],
      }),
    ).toEqual(["review-open:review-open:environment-test:project-a"]);
  });

  it("turns the checkout's status into commit, pull and open-PR work", () => {
    const suggestions = deriveLaunchpadSuggestions({
      authored: [],
      reviewing: [],
      checkouts: [
        {
          project: null,
          name: null,
          git: {
            ...cleanGit,
            refName: "feature",
            isDefaultRef: false,
            changedFileCount: 1,
            behindCount: 3,
            aheadOfDefaultCount: 2,
          },
        },
      ],
    });
    expect(suggestions.map((suggestion) => suggestion.title)).toEqual([
      "Commit 1 changed file",
      "Pull 3 new commits on feature",
      "Open a pull request for feature",
    ]);
    expect(suggestions.every((suggestion) => suggestion.project === null)).toBe(true);
    // Git work stays in the project's own checkout.
    expect(suggestions.every((suggestion) => suggestion.envMode === "local")).toBe(true);
  });

  it("names the project for a draft with no project yet, and picks it", () => {
    const project = (id: string) => ({ environmentId, projectId: ProjectId.make(id) });
    const suggestions = deriveLaunchpadSuggestions({
      authored: [],
      reviewing: [],
      checkouts: [
        {
          project: project("lumen"),
          name: "lumen",
          git: { ...cleanGit, changedFileCount: 3, behindCount: 4 },
        },
        { project: project("orbit"), name: "orbit", git: { ...cleanGit, behindCount: 2 } },
        { project: project("docs"), name: "docs", git: cleanGit },
      ],
    });
    expect(suggestions.map((suggestion) => suggestion.title)).toEqual([
      "Commit 3 changed files in lumen",
      "Pull 4 new commits into lumen",
      "Pull 2 new commits into orbit",
    ]);
    expect(suggestions.map((suggestion) => suggestion.project?.projectId)).toEqual([
      "lumen",
      "lumen",
      "orbit",
    ]);
    expect(new Set(suggestions.map((suggestion) => suggestion.id)).size).toBe(3);
  });

  it("offers no git work for a clean, current default branch or a branch with an open PR", () => {
    const checkout = (git: typeof cleanGit) => [{ project: null, name: null, git }];
    expect(kinds({ authored: [], reviewing: [], checkouts: checkout(cleanGit) })).toEqual([]);
    expect(
      kinds({
        authored: [],
        reviewing: [],
        checkouts: checkout({
          ...cleanGit,
          refName: "feature",
          isDefaultRef: false,
          aheadOfDefaultCount: 2,
          hasOpenPullRequest: true,
        }),
      }),
    ).toEqual([]);
  });

  it("reviews every open pull request once per project, after fixes and before merging", () => {
    const other = { projectId: ProjectId.make("project-b") };
    const suggestions = deriveLaunchpadSuggestions({
      authored: [pr(1, { reviewDecision: "approved", checksState: "passing" }), pr(2)],
      reviewing: [pr(2), pr(3, other), pr(4, { state: "merged" })],
      checkouts: [],
      offerDevServer: true,
    });
    expect(suggestions.map((suggestion) => suggestion.title)).toEqual([
      "Review 2 open PRs",
      "Review 1 open PR",
      "Merge #1 · PR 1",
      "Start the dev server",
    ]);
    expect(suggestions[0]?.prompt).toContain("(#1, #2)");
    expect(suggestions[1]?.project?.projectId).toBe("project-b");
  });

  it("stops at four", () => {
    expect(
      deriveLaunchpadSuggestions({
        authored: [1, 2, 3, 4, 5].map((number) => pr(number, { checksState: "failing" })),
        reviewing: [],
        checkouts: [],
      }),
    ).toHaveLength(4);
  });
});
