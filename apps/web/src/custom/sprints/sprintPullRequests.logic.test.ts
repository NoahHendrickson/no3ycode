import { ThreadId } from "@t3tools/contracts";
import { FORK_BOT_WORK_TAG_PREFIX } from "@t3tools/shared/forkBotTags";
import { describe, expect, it } from "vite-plus/test";

import { makeThreadFixture } from "~/test-fixtures";

import { sprintPullRequests } from "./sprintPullRequests.logic";

function work(
  id: string,
  owner: string,
  updatedAt: string,
  links: ReadonlyArray<{ number: number; snapshot: object | null }>,
) {
  const thread = makeThreadFixture({ id: ThreadId.make(id) });
  return {
    ...thread,
    updatedAt,
    source: { ...thread.source, tags: [`${FORK_BOT_WORK_TAG_PREFIX}${owner}`] },
    pullRequests: links.map(({ number, snapshot }) => ({
      host: "github.com",
      repository: "o/r",
      number,
      url: `https://github.com/o/r/pull/${number}`,
      source: "created",
      snapshot: snapshot === null ? null : { title: `PR ${number}`, ...snapshot },
    })) as never,
  };
}

describe("sprintPullRequests", () => {
  const sprint = { environmentId: "environment-test", threadId: "sprint" };
  const open = { state: "open", isDraft: false };

  it("lists the sprint's threads' PRs once each, what needs the owner first", () => {
    const threads = [
      work("older", "sprint", "2026-11-01T00:00:00.000Z", [
        { number: 1, snapshot: { state: "merged", isDraft: false } },
        { number: 2, snapshot: { ...open, checksState: "pending" } },
      ]),
      work("newer", "sprint", "2026-11-02T00:00:00.000Z", [
        { number: 3, snapshot: { ...open, checksState: "failing" } },
        { number: 2, snapshot: { ...open, checksState: "pending" } },
        { number: 4, snapshot: null },
      ]),
      work("someone-else", "petal", "2026-11-03T00:00:00.000Z", [
        { number: 9, snapshot: { ...open, checksState: "failing" } },
      ]),
    ];
    expect(
      sprintPullRequests(threads, sprint).map((row) => [row.number, row.stage, row.thread.id]),
    ).toEqual([
      [3, "checks-failing", "newer"],
      [2, "checks-running", "newer"],
      [4, null, "newer"],
      [1, "merged", "older"],
    ]);
  });

  it("leaves out archived threads, as the Threads tab does", () => {
    const archived = {
      ...work("done", "sprint", "2026-11-01T00:00:00.000Z", [{ number: 5, snapshot: null }]),
      archivedAt: "2026-11-02T00:00:00.000Z",
    };
    expect(sprintPullRequests([archived], sprint)).toEqual([]);
  });
});
