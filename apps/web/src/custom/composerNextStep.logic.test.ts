import { ThreadPullRequestLink } from "@t3tools/contracts";
import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
  type ComposerNextStepInput,
  nextStepPullRequestFromBranch,
  nextStepPullRequestFromLinks,
  lastOwnerPrompt,
  resolveComposerNextStep,
} from "./composerNextStep.logic";

const decodeLink = Schema.decodeSync(ThreadPullRequestLink);

const watchFields = {
  startedAt: "2026-11-23T12:00:00.000Z",
  headSha: null,
  failedChecks: [],
  passed: false,
  remarksThrough: "2026-11-23T12:00:00.000Z",
  remarkIds: [],
  conflicting: false,
  wakes: 0,
};

const link = (
  number: number,
  options: {
    readonly linkedAt?: string;
    readonly repository?: string;
    readonly state?: "open" | "closed" | "merged";
    readonly checksState?: "passing" | "failing" | "pending";
    readonly watch?: "active" | "ended";
    readonly source?: "agent" | "stack-dismissed";
  } = {},
) =>
  decodeLink({
    host: "github.com",
    repository: options.repository ?? "acme/app",
    number,
    url: `https://github.com/${options.repository ?? "acme/app"}/pull/${number}`,
    source: options.source ?? "agent",
    linkedAt: options.linkedAt ?? "2026-11-23T12:00:00.000Z",
    snapshot: {
      state: options.state ?? "open",
      title: `PR ${number}`,
      headBranch: `feature-${number}`,
      baseBranch: "main",
      isDraft: false,
      updatedAt: null,
      syncedAt: "2026-11-23T12:00:00.000Z",
      checksState: options.checksState ?? "pending",
      mergeability: "mergeable",
      reviewDecision: null,
    },
    stack: null,
    ...(options.watch === "active" ? { watch: watchFields } : {}),
    ...(options.watch === "ended" ? { endedWatch: watchFields } : {}),
  });

const branchWork = { isDefaultRef: false, hasPrimaryRemote: true, hasWork: true };

const step = (input: Partial<ComposerNextStepInput>) => {
  const next = resolveComposerNextStep({
    lastOwnerPrompt: null,
    pullRequest: null,
    git: null,
    ...input,
  });
  return next === null || next === "hold" ? next : next.kind;
};

describe("resolveComposerNextStep", () => {
  it("follows the chain from sol loop to release", () => {
    expect(step({ lastOwnerPrompt: "run a sol loop please", git: branchWork })).toBe("open-pr");
    expect(
      step({ lastOwnerPrompt: "open a pr", pullRequest: nextStepPullRequestFromLinks([link(1)]) }),
    ).toBe("babysit");
    expect(
      step({
        pullRequest: nextStepPullRequestFromLinks([
          link(1, { watch: "ended", checksState: "passing" }),
        ]),
      }),
    ).toBe("merge");
    expect(
      step({
        lastOwnerPrompt: "lets merge",
        pullRequest: nextStepPullRequestFromLinks([
          link(1, { state: "merged", repository: "NoahHendrickson/no3ycode" }),
        ]),
      }),
    ).toBe("release");
  });

  it("holds while the PR is the owner's call, so nothing learned shows either", () => {
    // Babysitting already.
    expect(
      step({ pullRequest: nextStepPullRequestFromLinks([link(1, { watch: "active" })]) }),
    ).toBe("hold");
    // The watch ended with checks failing.
    expect(
      step({
        pullRequest: nextStepPullRequestFromLinks([
          link(1, { watch: "ended", checksState: "failing" }),
        ]),
      }),
    ).toBe("hold");
  });

  it("leaves everything else to learned habits", () => {
    expect(step({ lastOwnerPrompt: "why is this slow?", git: branchWork })).toBe(null);
    // Sol loop on the default branch: nowhere to open a PR from.
    expect(
      step({ lastOwnerPrompt: "run a sol loop", git: { ...branchWork, isDefaultRef: true } }),
    ).toBe(null);
    expect(
      step({ lastOwnerPrompt: "run a sol loop", git: { ...branchWork, hasWork: false } }),
    ).toBe(null);
  });

  it("cuts a release only right after merging this fork's PR", () => {
    const merged = (repository: string) =>
      nextStepPullRequestFromLinks([link(1, { state: "merged", repository })]);
    expect(step({ lastOwnerPrompt: "merge it", pullRequest: merged("acme/app") })).toBe(null);
    expect(
      step({ lastOwnerPrompt: "thanks", pullRequest: merged("NoahHendrickson/no3ycode") }),
    ).toBe(null);
    expect(
      step({
        lastOwnerPrompt: "merge it",
        pullRequest: nextStepPullRequestFromBranch({
          state: "merged",
          url: "https://github.com/NoahHendrickson/no3ycode/pull/9",
        }),
      }),
    ).toBe("release");
  });

  it("babysits a PR opened without a thread link", () => {
    expect(
      step({
        lastOwnerPrompt: "open a pr",
        pullRequest: nextStepPullRequestFromBranch({
          state: "open",
          url: "https://github.com/acme/app/pull/3",
        }),
        git: branchWork,
      }),
    ).toBe("babysit");
  });
});

describe("nextStepPullRequestFromLinks", () => {
  it("reads the most recently linked PR", () => {
    const pr = nextStepPullRequestFromLinks([
      link(2, { linkedAt: "2026-11-23T13:00:00.000Z", watch: "active" }),
      link(1, { linkedAt: "2026-11-23T12:00:00.000Z" }),
    ]);
    expect(pr?.watching).toBe(true);
    // A dismissed stack member is a tombstone, not the thread's PR.
    expect(
      nextStepPullRequestFromLinks([
        link(3, { linkedAt: "2026-11-23T14:00:00.000Z", source: "stack-dismissed" }),
        link(1, { linkedAt: "2026-11-23T12:00:00.000Z", watch: "active" }),
      ])?.watching,
    ).toBe(true);
    expect(nextStepPullRequestFromLinks([])).toBe(null);
  });
});

describe("lastOwnerPrompt", () => {
  const owner = (text: string) => ({ role: "user", createdBy: "user", text }) as const;

  it("skips scheduled, agent-sent and watch-wake messages", () => {
    expect(
      lastOwnerPrompt([
        owner("build it"),
        owner("run a sol loop"),
        { ...owner("from the cli"), createdBy: "agent" },
        { ...owner("checks passed"), notification: { kind: "pull-request" } },
        { ...owner("nightly"), scheduledTaskId: "scheduled-task:1" },
        { ...owner("from a guest"), context: { guest: { name: "Sam" } } },
      ]),
    ).toBe("run a sol loop");
    expect(lastOwnerPrompt([])).toBe(null);
  });
});
