import { ThreadPullRequestLink } from "@t3tools/contracts";
import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { lastOwnerPrompt, pickComposerNextStep } from "./forkComposerNextStep.ts";

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
    readonly synced?: boolean;
  } = {},
) =>
  decodeLink({
    host: "github.com",
    repository: options.repository ?? "acme/app",
    number,
    url: `https://github.com/${options.repository ?? "acme/app"}/pull/${number}`,
    source: options.source ?? "agent",
    linkedAt: options.linkedAt ?? "2026-11-23T12:00:00.000Z",
    snapshot:
      options.synced === false
        ? null
        : {
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

const branchWork = {
  isRepo: true,
  refName: "feature",
  isDefaultRef: false,
  hasPrimaryRemote: true,
  hasWorkingTreeChanges: true,
  pr: null,
};
const habit = { previousKey: "done", nextKey: "deploy", text: "deploy it" };

const step = (input: Partial<Parameters<typeof pickComposerNextStep>[0]>) =>
  pickComposerNextStep({
    lastOwnerPrompt: null,
    links: [],
    branch: "feature",
    branchPullRequest: null,
    gitStatus: null,
    habit: null,
    ...input,
  })?.kind ?? null;

describe("pickComposerNextStep", () => {
  it("follows the chain from sol loop to release", () => {
    expect(step({ lastOwnerPrompt: "run a sol loop please", gitStatus: branchWork })).toBe(
      "open-pr",
    );
    expect(step({ lastOwnerPrompt: "open a pr", links: [link(1)] })).toBe("babysit");
    expect(step({ links: [link(1, { watch: "ended", checksState: "passing" })] })).toBe("merge");
    expect(
      step({
        lastOwnerPrompt: "lets merge",
        links: [link(1, { state: "merged", repository: "NoahHendrickson/no3ycode" })],
      }),
    ).toBe("release");
  });

  it("holds while the PR is the owner's call, so nothing learned shows either", () => {
    // Babysitting already.
    expect(step({ links: [link(1, { watch: "active" })], habit })).toBe(null);
    // A watch that started before the link's first snapshot, on a PR git status also sees.
    expect(
      step({
        links: [link(1, { watch: "active", synced: false })],
        gitStatus: {
          ...branchWork,
          pr: { state: "open", url: "https://github.com/acme/app/pull/1" },
        },
        habit,
      }),
    ).toBe(null);
    // The watch ended with checks failing.
    expect(step({ links: [link(1, { watch: "ended", checksState: "failing" })], habit })).toBe(
      null,
    );
  });

  it("leaves everything else to learned habits", () => {
    expect(step({ lastOwnerPrompt: "why is this slow?", gitStatus: branchWork })).toBe(null);
    expect(step({ lastOwnerPrompt: "why is this slow?", gitStatus: branchWork, habit })).toBe(
      "learned",
    );
    // Sol loop on the default branch: nowhere to open a PR from.
    expect(
      step({ lastOwnerPrompt: "run a sol loop", gitStatus: { ...branchWork, isDefaultRef: true } }),
    ).toBe(null);
    expect(
      step({
        lastOwnerPrompt: "run a sol loop",
        gitStatus: { ...branchWork, hasWorkingTreeChanges: false },
      }),
    ).toBe(null);
    // A checkout on another branch is not this thread's work.
    expect(
      step({ lastOwnerPrompt: "run a sol loop", gitStatus: { ...branchWork, refName: "other" } }),
    ).toBe(null);
  });

  it("cuts a release only right after merging this fork's PR", () => {
    const merged = (repository: string) => [link(1, { state: "merged", repository })];
    expect(step({ lastOwnerPrompt: "merge it", links: merged("acme/app") })).toBe(null);
    expect(step({ lastOwnerPrompt: "thanks", links: merged("NoahHendrickson/no3ycode") })).toBe(
      null,
    );
    for (const said of ["don't merge it yet", "merge upstream/main into this branch"]) {
      expect(step({ lastOwnerPrompt: said, links: merged("NoahHendrickson/no3ycode") })).toBe(null);
    }
  });

  it("babysits an open PR on the branch that the thread has not linked", () => {
    const url = "https://github.com/acme/app/pull/3";
    expect(step({ gitStatus: { ...branchWork, pr: { state: "open", url } } })).toBe("babysit");
    expect(step({ branchPullRequest: { state: "open", url } })).toBe("babysit");
    // An old PR on a reused branch does not stop a new one.
    expect(
      step({
        lastOwnerPrompt: "run a sol loop",
        branchPullRequest: { state: "merged", url },
        gitStatus: { ...branchWork, pr: { state: "closed", url } },
      }),
    ).toBe("open-pr");
  });

  it("reads the most recently linked PR, skipping dismissed stack members", () => {
    expect(
      step({
        links: [
          link(2, { linkedAt: "2026-11-23T13:00:00.000Z", watch: "active" }),
          link(1, { linkedAt: "2026-11-23T12:00:00.000Z" }),
        ],
      }),
    ).toBe(null);
    expect(
      step({
        links: [
          link(3, { linkedAt: "2026-11-23T14:00:00.000Z", source: "stack-dismissed" }),
          link(1, { linkedAt: "2026-11-23T12:00:00.000Z", watch: "active" }),
        ],
      }),
    ).toBe(null);
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
