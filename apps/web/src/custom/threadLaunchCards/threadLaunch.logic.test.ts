import { MessageId, NodeId, RunId, RuntimeRequestId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { deriveMessagesTimelineRows } from "~/components/chat/MessagesTimeline.logic";
import type { TimelineEntry } from "~/session-logic";

import {
  type ForkThreadLaunch,
  forkThreadLaunchFromToolItem,
  threadLaunchActivityLine,
  threadLaunchPullRequests,
  threadPullRequestStage,
} from "./threadLaunch.logic";
import {
  forkDelegatedQuestionOf,
  forkWorkReportRequestId,
  forkWorkReportKey,
  forkWorkReportOf,
  forkWorkReportRequestKind,
  forkWorkReportThreadId,
} from "../forkWorkReports";
import { pendingRequestFor } from "../childRequestControls";

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

  it("reads the server's named thread and request first, and an older report from its id", () => {
    const id = itemId("message:fork-bot-work-report:mcp:t1:request-1");
    const named = forkWorkReportOf({
      id,
      summary: "Rate limiting waits for you",
      source: {
        kind: "system",
        forkWorkReport: {
          threadId: ThreadId.make("mcp:t1"),
          request: { id: RuntimeRequestId.make("request-1"), kind: "approval" },
        },
      },
    });
    expect(named).toEqual({ key: "mcp:t1:request-1", threadId: "mcp:t1", requestKind: "approval" });
    expect(forkWorkReportRequestId(named!.key, "mcp:t1")).toBe("request-1");
    expect(
      forkWorkReportOf({ id, summary: "Rate limiting has a question", source: { kind: "system" } }),
    ).toEqual({ key: "mcp:t1:request-1", threadId: null, requestKind: "question" });
    expect(
      forkWorkReportOf({ id: "turn-item:provider:x", summary: "x", source: { kind: "system" } }),
    ).toBeNull();
  });

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

  it("reads a delegated child's question as the child's report, in its parent only", () => {
    const unnamed = { kind: "delegated_task" as const, taskIds: [NodeId.make("task-1")] };
    const source = { ...unnamed, childThreadId: ThreadId.make("mcp:child") };
    const id = itemId("message:delegated-task-question:mcp:p1:request:9");
    const report = forkDelegatedQuestionOf({ id, threadId: "mcp:p1", source });
    expect(report).toEqual({
      key: "mcp:child:request:9",
      threadId: "mcp:child",
      requestKind: "question",
    });
    expect(forkWorkReportRequestId(report!.key, "mcp:child")).toBe("request:9");
    expect(forkDelegatedQuestionOf({ id, threadId: "mcp:p", source })).toBeNull();
    expect(forkDelegatedQuestionOf({ id, threadId: "mcp:p1", source: unnamed })).toBeNull();
    expect(
      forkDelegatedQuestionOf({
        id: itemId("message:delegated-task-result:mcp:p1:task-1"),
        threadId: "mcp:p1",
        source,
      }),
    ).toBeNull();
  });
});

describe("thread requests from reports", () => {
  it("tells a question or approval report from a finished one", () => {
    expect(forkWorkReportRequestKind("Rate limiting has a question")).toBe("question");
    expect(forkWorkReportRequestKind("Rate limiting needs an approval")).toBe("approval");
    expect(forkWorkReportRequestKind("Rate limiting finished")).toBeNull();
  });

  it("reads the request a report names, so its card answers that one", () => {
    expect(forkWorkReportRequestId("mcp:t1:request-1", "mcp:t1")).toBe("request-1");
    expect(forkWorkReportRequestId("mcp:t1", "mcp:t1")).toBeNull();
    expect(forkWorkReportRequestId("mcp:t2:request-1", "mcp:t1")).toBeNull();
  });
});

describe("pendingRequestFor", () => {
  it("binds a card to its report's request, not the thread's first open one", () => {
    const older = { requestId: RuntimeRequestId.make("request-1") };
    const newer = { requestId: RuntimeRequestId.make("request-2") };
    expect(pendingRequestFor([older, newer], newer.requestId)).toBe(newer);
    expect(pendingRequestFor([older, newer], RuntimeRequestId.make("request-3"))).toBeUndefined();
    // A caller naming none (a Petal digest) keeps the first.
    expect(pendingRequestFor([older, newer], undefined)).toBe(older);
  });
});
