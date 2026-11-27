import { MessageId, RunId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { deriveMessagesTimelineRows } from "~/components/chat/MessagesTimeline.logic";
import type { TimelineEntry } from "~/session-logic";

import {
  type ForkThreadLaunch,
  forkThreadLaunchFromToolItem,
  threadLaunchActivityLine,
  forkWorkReportIsPending,
  forkWorkReportKey,
  forkWorkReportRequestKind,
  forkWorkReportThreadId,
  threadLaunchPullRequests,
  threadPullRequestStage,
  sprintAnswerLine,
  sprintAnswersFor,
  withSprintAnswer,
} from "./threadLaunch.logic";

describe("forkThreadLaunchFromToolItem", () => {
  const input = { title: "Optimize images", message: "Swap the hero to next/image" };
  it.each([
    {
      name: "a finished Claude call",
      item: {
        toolName: "mcp__t3-code__t3_thread_launch",
        input,
        output: { threadId: "thread-1" },
        status: "completed" as const,
      },
      launch: {
        title: "Optimize images",
        threadId: "thread-1",
        environmentId: null,
        callStatus: "started",
      },
    },
    {
      name: "a Codex call to another machine, still running",
      item: {
        toolName: "t3-code.t3_thread_launch",
        input: { ...input, environmentId: "env-2" },
        status: "running" as const,
      },
      launch: {
        title: "Optimize images",
        threadId: null,
        environmentId: "env-2",
        callStatus: "starting",
      },
    },
    {
      name: "a call that failed",
      item: {
        toolName: "mcp__t3-code__t3_thread_launch",
        input,
        output: { isError: true },
        status: "completed" as const,
      },
      launch: {
        title: "Optimize images",
        threadId: null,
        environmentId: null,
        callStatus: "failed",
      },
    },
    {
      name: "an input cut down on the wire",
      item: {
        toolName: "mcp__t3-code__t3_thread_launch",
        input: { summary: "…", truncated: true },
        output: { threadId: "thread-1" },
        status: "completed" as const,
      },
      launch: { title: null, threadId: "thread-1", environmentId: null, callStatus: "started" },
    },
  ])("reads $name", ({ item, launch }) => {
    expect(forkThreadLaunchFromToolItem(item)).toEqual(launch);
  });

  it("ignores other tools", () => {
    expect(
      forkThreadLaunchFromToolItem({
        toolName: "mcp__t3-code__t3_thread_send",
        input,
        status: "completed",
      }),
    ).toBeUndefined();
  });
});

describe("threadLaunchActivityLine", () => {
  it.each([
    ["Reading the nav and footer components", "Reading the nav and footer components"],
    ["\n\n## Plan\nStep one", "Plan"],
    ["**`CustomerLogos.tsx`** is done", "CustomerLogos.tsx is done"],
    ["- See [the PR](https://example.com/1)", "See the PR"],
    ["```ts\nconst a = 1;", "const a = 1;"],
    ["   ", null],
    [null, null],
  ])("reads %j as %j", (text, line) => {
    expect(threadLaunchActivityLine(text)).toBe(line);
  });
});

describe("launch rows", () => {
  const at = "2026-11-27T10:00:00.000Z";
  const launchEntry = (id: string, runId: string): TimelineEntry => ({
    id,
    kind: "fork-thread-launch",
    createdAt: at,
    runId: RunId.make(runId),
    launch: {
      title: id,
      threadId: ThreadId.make(`thread-${id}`),
      environmentId: null,
      callStatus: "started",
    } satisfies ForkThreadLaunch,
  });

  it("stacks one run's launches in one row and keeps another run's apart", () => {
    const rows = deriveMessagesTimelineRows({
      timelineEntries: [
        launchEntry("a", "run-1"),
        launchEntry("b", "run-1"),
        launchEntry("c", "run-2"),
      ],
      isWorking: false,
      turnDiffSummaries: [],
      supportsConversationRollback: false,
    });
    const launchRows = rows.filter((row) => row.kind === "fork-thread-launch");
    expect(launchRows.map((row) => row.launches.map((launch) => launch.id))).toEqual([
      ["a", "b"],
      ["c"],
    ]);
  });

  const reply = (id: string, runId: string): TimelineEntry => ({
    id,
    kind: "message",
    createdAt: at,
    message: {
      id: MessageId.make(id),
      role: "assistant",
      runId: RunId.make(runId),
      text: id,
      streaming: false,
      createdAt: at,
      updatedAt: at,
    },
  });
  const order = (timelineEntries: TimelineEntry[]) =>
    deriveMessagesTimelineRows({
      timelineEntries,
      isWorking: false,
      turnDiffSummaries: [],
      supportsConversationRollback: false,
    }).flatMap((row) =>
      row.kind === "fork-thread-launch"
        ? [`launch:${row.launches.map((launch) => launch.id).join("+")}`]
        : row.kind === "message"
          ? [
              `reply:${row.message.id}`,
              ...(row.forkLaunches === undefined
                ? []
                : [`in-reply:${row.forkLaunches.map((launch) => launch.id).join("+")}`]),
            ]
          : row.kind === "assistant-meta"
            ? [`actions:${row.message.id}`]
            : [],
    );

  it("hangs a turn's launches, made anywhere in it, under its last reply as one group", () => {
    expect(
      order([
        launchEntry("a", "run-1"),
        reply("starting", "run-1"),
        launchEntry("b", "run-1"),
        reply("started", "run-1"),
      ]),
      // The earlier reply folds into the turn; the one that shows draws the launches, above its
      // own actions, so no separate actions row is split off.
    ).toEqual(["reply:started", "in-reply:a+b"]);
  });

  it("leaves launches where they were in a turn with no reply", () => {
    expect(order([launchEntry("a", "run-1"), reply("other", "run-2")])).toEqual([
      "launch:a",
      "reply:other",
    ]);
  });
});

describe("threadPullRequestStage", () => {
  const open = { state: "open", isDraft: false } as const;
  it.each([
    ["nothing synced yet", null, null],
    ["a draft, whatever its checks", { ...open, isDraft: true, checksState: "failing" }, "draft"],
    ["failing checks", { ...open, checksState: "failing" }, "checks-failing"],
    ["running checks", { ...open, checksState: "pending" }, "checks-running"],
    ["a mergeable PR", { ...open, checksState: "passing", mergeability: "mergeable" }, "ready"],
    [
      "changes requested",
      {
        ...open,
        checksState: "passing",
        mergeability: "mergeable",
        reviewDecision: "changes-requested",
      },
      null,
    ],
    ["a conflict", { ...open, checksState: "passing", mergeability: "conflicting" }, null],
    ["merged", { state: "merged", isDraft: false, checksState: "failing" }, "merged"],
    ["closed", { state: "closed", isDraft: false }, "closed"],
  ])("reads %s", (_name, snapshot, stage) => {
    expect(threadPullRequestStage(snapshot as never)).toBe(stage);
  });
});

describe("threadLaunchPullRequests", () => {
  const branch = { projectId: "p", repository: "o/r", number: 31, url: "https://h/o/r/pull/31" };

  it("shows the branch's pull request when the thread has no links", () => {
    expect(
      threadLaunchPullRequests({
        pullRequests: [],
        linkedPullRequest: null,
        branchPullRequest: branch as never,
      }),
    ).toEqual([{ number: 31, url: "https://h/o/r/pull/31", title: null, stage: null }]);
  });

  it("lists each pull request once, the link's details first", () => {
    expect(
      threadLaunchPullRequests({
        pullRequests: [
          {
            number: 31,
            url: "https://h/o/r/pull/31",
            source: "created",
            snapshot: { state: "merged", title: "Cinnabars page" },
          } as never,
        ],
        linkedPullRequest: branch as never,
        branchPullRequest: branch as never,
      }),
    ).toEqual([
      { number: 31, url: "https://h/o/r/pull/31", title: "Cinnabars page", stage: "merged" },
    ]);
  });
});

describe("work report notifications", () => {
  const itemId = (messageId: string) => `turn-item:message:${encodeURIComponent(messageId)}`;

  it("names the reporting thread, even one whose id holds colons", () => {
    const key = forkWorkReportKey(
      itemId(
        "message:fork-bot-work-report:mcp:launch:41a1:run:thread:mcp%3Alaunch%3A41a1:ordinal:9:completed",
      ),
    );
    expect(key).not.toBeNull();
    expect(forkWorkReportThreadId(key!, ["mcp:launch", "mcp:launch:41a1", "other"])).toBe(
      "mcp:launch:41a1",
    );
  });

  it("reads a watched report and ignores other notifications", () => {
    expect(forkWorkReportKey(itemId("message:fork-bot-work-seen:t1:run:x:failed"))).toBe(
      "t1:run:x:failed",
    );
    expect(forkWorkReportKey(itemId("message:scheduled-wake:t1"))).toBeNull();
    expect(forkWorkReportKey("turn-item:provider:x")).toBeNull();
    expect(forkWorkReportThreadId("t1:run:x", ["t2"])).toBeNull();
  });
});

describe("thread requests from reports", () => {
  it("tells a question or approval report from a finished one", () => {
    expect(forkWorkReportRequestKind("Rate limiting has a question")).toBe("question");
    expect(forkWorkReportRequestKind("Rate limiting needs an approval")).toBe("approval");
    expect(forkWorkReportRequestKind("Rate limiting finished")).toBeNull();
  });

  it("knows the report's request is the one the thread still waits on", () => {
    expect(forkWorkReportIsPending("mcp:t1:request-1", "mcp:t1", "request-1")).toBe(true);
    expect(forkWorkReportIsPending("mcp:t1:request-1", "mcp:t1", "request-2")).toBe(false);
    expect(forkWorkReportIsPending("mcp:t1:request-1", "mcp:t1", null)).toBe(false);
  });

  it("keeps the newest answers in the sprint's log", () => {
    const first = withSprintAnswer("", "a");
    expect(first).toContain("# Answers");
    expect(first.trimEnd().endsWith("- a")).toBe(true);
    const log = ["b", "c", "d"].reduce((text, line) => withSprintAnswer(text, line, 2), first);
    expect(log.match(/^- /gm)).toHaveLength(2);
    expect(log.trimEnd().endsWith("- c\n- d")).toBe(true);
  });
});

describe("sprint answers", () => {
  it("reads back the latest answers it wrote for each request", () => {
    const log = [
      ["r1", sprintAnswerLine([{ question: "Which color?", answer: "Blue" }])],
      [
        "r1",
        sprintAnswerLine([
          { question: "Which color?", answer: "Red (Recommended)" },
          { question: "Which size?", answer: "Large" },
        ]),
      ],
      [
        "r2",
        sprintAnswerLine([{ question: "Run\n  rm -rf dist; vp build", answer: "Allowed; once" }]),
      ],
    ].reduce(
      (text, [request, line]) =>
        withSprintAnswer(text, `2026-11-27 10:00: Pick (mcp:t1:${request}): ${line}`),
      "",
    );
    expect(sprintAnswersFor(log, "mcp:t1:r1")).toEqual([
      { question: "Which color?", answer: "Red (Recommended)" },
      { question: "Which size?", answer: "Large" },
    ]);
    expect(sprintAnswersFor(log, "mcp:t1:r2")).toEqual([
      { question: "Run rm -rf dist; vp build", answer: "Allowed; once" },
    ]);
    expect(sprintAnswersFor(log, "mcp:t1:r3")).toBeNull();
    expect(sprintAnswersFor("- 10:00: Pick (t2:r1): Which color? → blue", "t2:r1")).toEqual([
      { question: "Which color?", answer: "blue" },
    ]);
  });
});
