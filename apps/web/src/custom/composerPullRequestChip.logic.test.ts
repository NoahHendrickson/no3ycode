import { ThreadPullRequestLink } from "@t3tools/contracts";
import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
  resolvePullRequestChipChecks,
  resolvePullRequestChipState,
} from "./composerPullRequestChip.logic";

const decodeLink = Schema.decodeSync(ThreadPullRequestLink);

const link = (number: number, state: "open" | "closed" | "merged" | null) =>
  decodeLink({
    host: "github.com",
    repository: "acme/app",
    number,
    url: `https://github.com/acme/app/pull/${number}`,
    source: "agent",
    linkedAt: "2026-11-23T12:00:00.000Z",
    snapshot:
      state === null
        ? null
        : {
            state,
            title: `PR ${number}`,
            headBranch: `feature-${number}`,
            baseBranch: "main",
            isDraft: false,
            updatedAt: null,
            syncedAt: "2026-11-23T12:00:00.000Z",
          },
    stack: null,
  });

describe("resolvePullRequestChipState", () => {
  it.each([
    ["a single open PR", { badge: null, pr: { state: "open" as const }, pullRequests: [] }, "open"],
    [
      "a single draft PR",
      { badge: null, pr: { state: "open" as const, isDraft: true }, pullRequests: [] },
      "draft",
    ],
    [
      "a single merged PR",
      { badge: null, pr: { state: "merged" as const }, pullRequests: [] },
      "merged",
    ],
    ["a PR still pending", { badge: null, pr: null, pullRequests: [] }, undefined],
    [
      "one PR's badge follows the PR, not the badge",
      {
        badge: { kind: "pull-request" as const, others: 0, state: "open" as const },
        pr: null,
        pullRequests: [link(1, null)],
      },
      undefined,
    ],
    [
      "several PRs with one confirmed open",
      {
        badge: { kind: "pull-request" as const, others: 1, state: "open" as const },
        pr: null,
        pullRequests: [link(1, "merged"), link(2, "open")],
      },
      "open",
    ],
    [
      "several PRs open only because one is pending",
      {
        badge: { kind: "pull-request" as const, others: 1, state: "open" as const },
        pr: null,
        pullRequests: [link(1, "merged"), link(2, null)],
      },
      undefined,
    ],
    [
      "a merged stack",
      {
        badge: { kind: "stack" as const, layers: 2, state: "merged" as const },
        pr: null,
        pullRequests: [link(1, "merged"), link(2, "merged")],
      },
      "merged",
    ],
  ])("%s", (_name, input, expected) => {
    expect(resolvePullRequestChipState(input)).toBe(expected);
  });
});

describe("resolvePullRequestChipChecks", () => {
  const single = { kind: "pull-request" as const, others: 0, state: "open" as const };
  it.each([
    [
      "an open PR's checks",
      { badge: single, snapshot: { state: "open" as const, checksState: "failing" as const } },
      "failing",
    ],
    ["an open PR with no checks", { badge: null, snapshot: { state: "open" as const } }, null],
    [
      "a merged PR",
      { badge: single, snapshot: { state: "merged" as const, checksState: "passing" as const } },
      null,
    ],
    ["a PR still pending", { badge: null, snapshot: null }, null],
    [
      "several PRs",
      {
        badge: { ...single, others: 1 },
        snapshot: { state: "open" as const, checksState: "passing" as const },
      },
      null,
    ],
    [
      "a stack",
      {
        badge: { kind: "stack" as const, layers: 3, state: "open" as const },
        snapshot: { state: "open" as const, checksState: "passing" as const },
      },
      null,
    ],
  ])("%s", (_name, input, expected) => {
    expect(resolvePullRequestChipChecks(input)).toBe(expected);
  });
});
