import { MessageId, NodeId, RunId, RuntimeRequestId, ThreadId } from "@t3tools/contracts";
import { FORK_BOT_QUIET_REPLY } from "@t3tools/shared/forkBotTags";
import { describe, expect, it } from "vite-plus/test";

import { deriveMessagesTimelineRows } from "~/components/chat/MessagesTimeline.logic";
import type { TimelineEntry } from "~/session-logic";

import {
  type ForkThreadLaunch,
  forkThreadLaunchFromToolItem,
  threadLaunchActivityLine,
  threadLaunchPullRequests,
  threadPullRequestStage,
  threadRowLiveState,
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
import { legacyWorkReportEntry, workReportEntry } from "../forkWorkReportFixtures";

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

  const reply = (id: string, runId: string, text = id): TimelineEntry => ({
    id,
    kind: "message",
    createdAt: at,
    message: {
      id: MessageId.make(id),
      role: "assistant",
      runId: RunId.make(runId),
      text,
      streaming: false,
      createdAt: at,
      updatedAt: at,
    },
  });
  const order = (timelineEntries: TimelineEntry[], forkKeepRequestReports = false) =>
    deriveMessagesTimelineRows({
      timelineEntries,
      isWorking: false,
      turnDiffSummaries: [],
      supportsConversationRollback: false,
      forkKeepRequestReports,
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

  it("moves a launched thread's row to the latest reply that links its chip", () => {
    expect(
      order([
        launchEntry("a", "run-1"),
        reply("started", "run-1"),
        reply("mentions", "run-2", "Its findings ([Land PRs](t3-thread://v1/thread-a)):"),
        reply("other", "run-3", "Unrelated."),
        reply("again", "run-4", "Still on <t3-thread://v1/thread-a>."),
        reply("after", "run-5", "Later."),
      ]),
    ).toEqual([
      "reply:started",
      "reply:mentions",
      "reply:other",
      "reply:again",
      "in-reply:a",
      "reply:after",
    ]);
    // A folded intermediate narration linking the thread does not pull the row onto a terminal reply
    // that does not link it.
    const step: TimelineEntry = {
      id: "step",
      kind: "work",
      createdAt: at,
      entry: { id: "step", createdAt: at, runId: RunId.make("run-2"), label: "read", tone: "tool" },
    };
    expect(
      order([
        launchEntry("a", "run-1"),
        reply("started", "run-1"),
        reply("narration", "run-2", "Checking [Land PRs](t3-thread://v1/thread-a)..."),
        step,
        reply("done", "run-2", "All clear."),
      ]),
    ).toEqual(["reply:started", "in-reply:a", "reply:done"]);
    // While a later turn is still live, its narration does not pull the row back and forth.
    const live = deriveMessagesTimelineRows({
      timelineEntries: [
        launchEntry("a", "run-1"),
        reply("started", "run-1"),
        reply("narration", "run-2", "Checking [Land PRs](t3-thread://v1/thread-a)..."),
      ],
      isWorking: true,
      runningRunId: RunId.make("run-2"),
      turnDiffSummaries: [],
      supportsConversationRollback: false,
    }).flatMap((row) =>
      row.kind === "message"
        ? [
            `reply:${row.message.id}`,
            ...(row.forkLaunches === undefined
              ? []
              : [`in-reply:${row.forkLaunches.map((launch) => launch.id).join("+")}`]),
          ]
        : [],
    );
    expect(live).toEqual(["reply:started", "in-reply:a", "reply:narration"]);
  });

  it("moves a launched thread's row to the reply its work report started", () => {
    expect(
      order([
        launchEntry("a", "run-1"),
        launchEntry("b", "run-1"),
        reply("started", "run-1"),
        workReportEntry("thread-a", "run-2"),
        reply("woken", "run-2"),
      ]),
    ).toEqual(["reply:started", "in-reply:b", "reply:woken", "in-reply:a"]);
    // A question answered inline draws the thread in its own wake, so the row stays put — even if
    // the wake's reply also links the thread's chip.
    expect(
      order(
        [
          launchEntry("a", "run-1"),
          reply("started", "run-1"),
          workReportEntry("thread-a", "run-2", "question"),
          reply("woken", "run-2", "Answer [a](t3-thread://v1/thread-a) above."),
        ],
        true,
      ),
    ).toEqual(["reply:started", "in-reply:a", "reply:woken"]);
  });

  it("keeps a launched thread's row under its launch when no later reply refers to it", () => {
    expect(
      order([
        launchEntry("a", "run-1"),
        reply("started", "run-1"),
        reply("other", "run-2", "See [another](t3-thread://v1/thread-elsewhere)."),
        workReportEntry("thread-elsewhere", "run-3"),
        reply("woken", "run-3"),
      ]),
    ).toEqual(["reply:started", "in-reply:a", "reply:other", "reply:woken"]);
  });

  it("shows a launched thread once: its later turn reports add no second row", () => {
    const read: TimelineEntry = {
      id: "read",
      kind: "work",
      createdAt: at,
      entry: { id: "read", createdAt: at, runId: RunId.make("run-1"), label: "read", tone: "tool" },
    };
    const shown = (wakes: TimelineEntry[], runningRunId: string, forkKeepRequestReports = true) =>
      deriveMessagesTimelineRows({
        timelineEntries: [read, launchEntry("a", "run-1"), reply("started", "run-1"), ...wakes],
        isWorking: true,
        runningRunId: RunId.make(runningRunId),
        turnDiffSummaries: [],
        supportsConversationRollback: false,
        forkKeepRequestReports,
      }).flatMap((row) =>
        row.kind === "work"
          ? row.groupedEntries.flatMap((entry) =>
              entry.itemType === "notification" ? [entry.label] : [],
            )
          : row.kind === "message"
            ? (row.forkLaunches?.map((launch) => launch.id) ?? [])
            : row.kind === "turn-fold" || row.kind === "working"
              ? [row.id]
              : [],
      );
    // The launched thread finished a turn, twice, once reported by an older server that names it
    // only in the id. Each notice still starts its wake, so the launching turn keeps its fold, its
    // reply keeps the one row, and the working row sits below it.
    expect(
      shown(
        [workReportEntry("thread-a", "run-2"), legacyWorkReportEntry("thread-a", "run-3")],
        "run-3",
      ),
    ).toEqual(["turn-fold:run-1", "a", "working-indicator-row"]);
    // A question keeps its card where the conversation answers inline; a Petal draws only the row.
    const asked = [workReportEntry("thread-a", "run-2", "question")];
    expect(shown(asked, "run-2")).toEqual([
      "turn-fold:run-1",
      "a",
      "thread-a has a question",
      "working-indicator-row",
    ]);
    expect(shown(asked, "run-2", false)).toEqual(["turn-fold:run-1", "a", "working-indicator-row"]);
    // A thread never launched here keeps its report row.
    expect(shown([workReportEntry("thread-elsewhere", "run-2")], "run-2")).toEqual([
      "turn-fold:run-1",
      "a",
      "thread-elsewhere finished",
      "working-indicator-row",
    ]);
  });

  it("moves the launch row across visible wakes while quiet wakes drop launched reports and keep unlaunched latest", () => {
    const rows = deriveMessagesTimelineRows({
      timelineEntries: [
        launchEntry("a", "run-1"),
        reply("started", "run-1"),
        workReportEntry("thread-elsewhere", "run-2"),
        reply("quiet-1", "run-2", FORK_BOT_QUIET_REPLY),
        workReportEntry("thread-elsewhere", "run-3"),
        reply("quiet-2", "run-3", FORK_BOT_QUIET_REPLY),
        workReportEntry("thread-a", "run-4"),
        reply("ready", "run-4"),
        workReportEntry("thread-a", "run-5"),
        reply("quiet-3", "run-5", FORK_BOT_QUIET_REPLY),
      ],
      isWorking: false,
      turnDiffSummaries: [],
      supportsConversationRollback: false,
      forkQuietWakes: "bot",
      forkKeepRequestReports: true,
    });
    // The moved launch stays on the later reply's forkLaunches (where ForkThreadLaunchList draws
    // kind="launch" and ForkThreadReadyToMerge), never on the launch reply or as a report row.
    const startedRow = rows.find((row) => row.kind === "message" && row.message.id === "started");
    const readyRow = rows.find((row) => row.kind === "message" && row.message.id === "ready");
    expect(startedRow?.kind === "message" ? startedRow.forkLaunches : null).toBeUndefined();
    expect(readyRow?.kind === "message" ? readyRow.forkLaunches : null).toEqual([
      {
        id: "a",
        launch: {
          title: "a",
          threadId: ThreadId.make("thread-a"),
          environmentId: null,
          callStatus: "started",
        },
      },
    ]);
    // Unlaunched thread keeps only its latest quiet-wake report via lastThreadReportIds; launched
    // thread's reports (visible or quiet) draw no report row.
    const reportIds = rows.flatMap((row) =>
      row.kind === "work"
        ? row.groupedEntries.flatMap((entry) =>
            entry.itemType === "notification" ? [entry.id] : [],
          )
        : [],
    );
    expect(reportIds).toEqual([workReportEntry("thread-elsewhere", "run-3").id]);
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
    ).toEqual([
      {
        number: 31,
        url: "https://h/o/r/pull/31",
        title: null,
        state: null,
        checks: null,
        stage: null,
      },
    ]);
  });

  it("lists each pull request once, the link's details first, with chip state and open checks", () => {
    expect(
      threadLaunchPullRequests({
        pullRequests: [
          {
            number: 31,
            url: "https://h/o/r/pull/31",
            source: "created",
            snapshot: {
              state: "merged",
              isDraft: false,
              checksState: "passing",
              title: "Cinnabars page",
            },
          } as never,
          {
            number: 32,
            url: "https://h/o/r/pull/32",
            source: "created",
            snapshot: { state: "open", isDraft: false, checksState: "pending", title: null },
          } as never,
          {
            number: 33,
            url: "https://h/o/r/pull/33",
            source: "created",
            snapshot: { state: "open", isDraft: true, checksState: "failing", title: null },
          } as never,
        ],
        linkedPullRequest: branch as never,
        branchPullRequest: branch as never,
      }),
    ).toEqual([
      {
        number: 31,
        url: "https://h/o/r/pull/31",
        title: "Cinnabars page",
        state: "merged",
        checks: null,
        stage: "merged",
      },
      {
        number: 32,
        url: "https://h/o/r/pull/32",
        title: null,
        state: "open",
        checks: "pending",
        stage: "checks-running",
      },
      {
        number: 33,
        url: "https://h/o/r/pull/33",
        title: null,
        state: "draft",
        checks: "failing",
        stage: "draft",
      },
    ]);
  });
});

describe("threadRowLiveState", () => {
  const link = (number: number, snapshot: object) =>
    ({
      host: "h",
      repository: "o/r",
      number,
      url: `https://h/o/r/pull/${number}`,
      source: "created",
      linkedAt: "2026-11-27T10:00:00.000Z",
      snapshot,
      stack: null,
    }) as never;
  const ready = link(558, {
    state: "open",
    isDraft: false,
    checksState: "passing",
    mergeability: "mergeable",
  });
  const failing = link(559, { state: "open", isDraft: false, checksState: "failing" });
  const review = {
    taskId: "task-1",
    kind: "subagent",
    // oxlint-disable-next-line t3code/no-untranslated-copy -- a fixture, not copy
    description: "Neon review: sprint start page",
  } as const;
  const read = (
    status: Parameters<typeof threadRowLiveState>[1],
    pendingBackgroundTasks: ReadonlyArray<typeof review> = [],
    runtime = "idle",
  ) => {
    const state = threadRowLiveState(
      { pullRequests: [ready, failing], pendingBackgroundTasks, runtime: { status: runtime } },
      status,
    );
    return {
      activity: state.activity,
      stages: state.pullRequests.map((pr) => pr.stage),
      readyUrl: state.ready?.url ?? null,
    };
  };

  it("says ready to merge only once the thread is idle with nothing in the background", () => {
    expect(read("ready")).toEqual({
      activity: null,
      stages: ["ready", "checks-failing"],
      readyUrl: "https://h/o/r/pull/558",
    });
    // A review still running can change the PR, so it says that instead.
    expect(read("ready", [review])).toEqual({
      activity: "Waiting · Neon review: sprint start page",
      stages: [null, "checks-failing"],
      readyUrl: null,
    });
    // A watch on its PR waits on the owner's merge, so it neither shows nor holds ready back.
    const watch = {
      taskId: "pull-request-watch:h/o/r#558",
      kind: "monitor",
      // oxlint-disable-next-line t3code/no-untranslated-copy -- a fixture, not copy
      description: "Watching pull request #558",
    } as const;
    expect(read("waiting", [watch as never])).toEqual(read("ready"));
    // "waiting" is also a turn blocked on a thread wait, still at work.
    const busy = { activity: null, stages: [null, "checks-failing"], readyUrl: null };
    expect(read("waiting", [watch as never], "running")).toEqual(busy);
    expect(read("working")).toEqual(busy);
    expect(read(null)).toEqual(busy);
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
