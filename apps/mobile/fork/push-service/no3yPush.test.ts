import type { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { ProviderInstanceId, RuntimeRequestId, ScheduledTaskId } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { describe, expect, it, vi } from "vite-plus/test";

import { extractAgentNotificationDeepLink } from "../../src/features/agent-awareness/notificationPayload";
import type { No3yLiveActivityProps } from "../no3yLiveActivity";
import {
  apnsPayload,
  applyShellItem,
  isAutomationRunWithoutThread,
  liveActivityRequest,
  makeLiveActivityPublisher,
  makeTracker,
  observeThread,
  pairingTokenFromUrl,
  parseRegistration,
  type ApnsNotification,
} from "./no3yPush.mts";

function tracker() {
  const sent: ApnsNotification[] = [];
  const changes = { count: 0 };
  const t = makeTracker(
    "env-1" as EnvironmentId,
    (notification) => sent.push(notification),
    () => changes.count++,
  );
  t.projectTitles.set("project-1", "no3ycode");
  return Object.assign(t, { sent, changes });
}

type ObservedThread = Parameters<typeof observeThread>[1];

const thread = (
  overrides: Partial<
    Pick<
      ObservedThread,
      "status" | "pendingRuntimeRequest" | "settledOverride" | "latestRunCompletedAt"
    >
  >,
): ObservedThread => ({
  id: "thread-1" as ThreadId,
  projectId: "project-1" as ProjectId,
  lineage: {
    rootThreadId: "thread-1" as ThreadId,
    parentThreadId: null,
    relationshipToParent: null,
  },
  title: "Fix the composer",
  modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.4" },
  status: "running" as const,
  pendingRuntimeRequest: null,
  settledOverride: null,
  updatedAt: DateTime.makeUnsafe("2026-11-22T12:00:00.000Z"),
  latestRunId: null,
  archivedAt: null,
  creationSource: "web",
  ...overrides,
});

const subagent = (pendingRuntimeRequest: ObservedThread["pendingRuntimeRequest"]) => ({
  ...thread({ pendingRuntimeRequest }),
  id: "child-1" as ThreadId,
  lineage: {
    rootThreadId: "thread-1" as ThreadId,
    parentThreadId: "thread-1" as ThreadId,
    relationshipToParent: "subagent" as const,
  },
  title: "Delegated task",
  activityRunStatus: "waiting" as const,
});

const approval = (id: string) => ({
  id: RuntimeRequestId.make(id),
  kind: "command" as const,
  createdAt: DateTime.makeUnsafe("2026-11-22T12:00:00.000Z"),
});

describe("no3y push transitions", () => {
  it("alerts once per approval wait, never for the startup snapshot", () => {
    const t = tracker();
    observeThread(t, thread({ pendingRuntimeRequest: approval("a") }), true);
    expect(t.sent).toEqual([]);

    observeThread(t, thread({}), false);
    observeThread(t, thread({ pendingRuntimeRequest: approval("b") }), false);
    observeThread(t, thread({ pendingRuntimeRequest: approval("b") }), false);
    observeThread(t, thread({ pendingRuntimeRequest: approval("c") }), false);
    expect(t.sent.map((n) => n.body)).toEqual([
      "Approval needed: no3ycode",
      "Approval needed: no3ycode",
    ]);
  });

  it("alerts on the top-level thread when its subagent waits on an approval", () => {
    const t = tracker();
    observeThread(t, thread({}), true);
    observeThread(t, subagent(approval("child-a")), false);
    observeThread(t, subagent(approval("child-a")), false);
    observeThread(t, subagent(null), false);
    observeThread(t, subagent(approval("child-b")), false);
    expect(t.sent.map((n) => [n.title, n.body])).toEqual([
      ["Fix the composer", "Approval needed: no3ycode"],
      ["Fix the composer", "Approval needed: no3ycode"],
    ]);
  });

  it("only alerts a thread first seen already finished when it finished while watching", () => {
    using _timers = { [Symbol.dispose]: () => vi.useRealTimers() };
    vi.useFakeTimers();
    const t = tracker();
    const before = DateTime.makeUnsafe(t.startedAt - 1_000);
    observeThread(t, thread({ status: "completed", latestRunCompletedAt: before }), false);
    vi.advanceTimersByTime(5_000);
    expect(t.sent).toEqual([]);

    const later = DateTime.makeUnsafe(t.startedAt + 1_000);
    const unseen = { ...thread({ status: "completed", latestRunCompletedAt: later }) };
    observeThread(t, { ...unseen, id: "thread-2" as ThreadId }, false);
    vi.advanceTimersByTime(5_000);
    expect(t.sent.map((n) => n.body)).toEqual(["Agent finished: no3ycode"]);
  });

  it("stays silent for an automation run hidden from the thread list until it is pinned", () => {
    const t = tracker();
    const run = { scheduledTaskId: ScheduledTaskId.make("scheduled-task:review") };
    observeThread(t, { ...thread({}), ...run }, false);
    observeThread(t, { ...thread({ pendingRuntimeRequest: approval("a") }), ...run }, false);
    expect(t.sent).toEqual([]);

    const pinned = { ...run, pinnedAt: DateTime.makeUnsafe("2026-11-22T12:00:00.000Z") };
    observeThread(t, { ...thread({ pendingRuntimeRequest: approval("b") }), ...pinned }, false);
    expect(t.sent.map((n) => n.body)).toEqual(["Approval needed: no3ycode"]);
  });

  it("holds a completion and drops it when the thread resumes", () => {
    using _timers = { [Symbol.dispose]: () => vi.useRealTimers() };
    vi.useFakeTimers();
    const t = tracker();
    observeThread(t, thread({}), false);
    observeThread(t, thread({ status: "completed" }), false);
    observeThread(t, thread({}), false);
    vi.advanceTimersByTime(5_000);
    expect(t.sent).toEqual([]);

    observeThread(t, thread({ status: "completed" }), false);
    vi.advanceTimersByTime(5_000);
    expect(t.sent.map((n) => [n.title, n.body])).toEqual([
      ["Fix the composer", "Agent finished: no3ycode"],
    ]);
  });

  it("still alerts a completion that is settled during the hold", () => {
    using _timers = { [Symbol.dispose]: () => vi.useRealTimers() };
    vi.useFakeTimers();
    const t = tracker();
    observeThread(t, thread({}), false);
    observeThread(t, thread({ status: "completed" }), false);
    observeThread(t, thread({ status: "completed", settledOverride: "settled" }), false);
    vi.advanceTimersByTime(5_000);
    expect(t.sent.map((n) => n.body)).toEqual(["Agent finished: no3ycode"]);
  });
});

describe("live activity rows", () => {
  const card = (t: ReturnType<typeof tracker>) =>
    [...t.activity.values()].map(({ state, provider }) => [state.threadId, state.phase, provider]);

  it("follows a thread from running to finished to settled, even in the startup snapshot", () => {
    const t = tracker();
    observeThread(t, thread({}), true);
    expect(card(t)).toEqual([["thread-1", "running", "codex"]]);
    observeThread(t, thread({ status: "completed" }), false);
    expect(card(t)).toEqual([["thread-1", "completed", "codex"]]);
    observeThread(t, thread({ status: "completed", settledOverride: "settled" }), false);
    expect(card(t)).toEqual([]);
    expect(t.changes.count).toBe(3);
  });

  it("leaves off hidden automation runs and work that finished before the service started", () => {
    const t = tracker();
    const run = { scheduledTaskId: ScheduledTaskId.make("scheduled-task:review") };
    observeThread(t, { ...thread({}), ...run }, false);
    const before = DateTime.makeUnsafe(t.startedAt - 1_000);
    const done = thread({ status: "completed", latestRunCompletedAt: before });
    observeThread(t, { ...done, id: "thread-2" as ThreadId }, true);
    expect(card(t)).toEqual([]);
    expect(t.changes.count).toBe(0);
  });

  it("drops rows a reconnect snapshot no longer has, and wakes the publisher regardless", () => {
    const t = tracker();
    observeThread(t, thread({}), true);
    const other = { ...thread({ status: "completed" }), id: "thread-2" as ThreadId };
    const snapshot = (threads: ReadonlyArray<ObservedThread>) =>
      ({ kind: "snapshot", snapshot: { projects: [], threads } }) as unknown as Parameters<
        typeof applyShellItem
      >[1];
    applyShellItem(t, snapshot([other]));
    expect(card(t)).toEqual([]);
    const changes = t.changes.count;
    applyShellItem(t, snapshot([other]));
    expect(t.changes.count).toBe(changes + 1);

    // An empty full snapshot is authoritative too; a projects-only refresh is not.
    observeThread(t, thread({}), false);
    applyShellItem(t, {
      kind: "snapshot",
      snapshot: { projects: [], threads: [] },
      resolvedRepositoryIdentityRoots: [],
    } as unknown as Parameters<typeof applyShellItem>[1]);
    expect(card(t)).toEqual([["thread-1", "running", "codex"]]);
    applyShellItem(t, snapshot([]));
    expect(card(t)).toEqual([]);
  });

  it("lets a parent stop waiting when its waiting subagent is gone from a reconnect snapshot", () => {
    const t = tracker();
    observeThread(t, thread({}), true);
    observeThread(t, subagent(approval("child-a")), true);
    expect(card(t)).toEqual([["thread-1", "waiting_for_approval", "codex"]]);
    applyShellItem(t, {
      kind: "snapshot",
      snapshot: { projects: [], threads: [thread({})] },
    } as unknown as Parameters<typeof applyShellItem>[1]);
    expect(card(t)).toEqual([["thread-1", "running", "codex"]]);
  });
});

describe("live activity pushes", () => {
  const row = (phase: No3yLiveActivityProps["rows"][number]["phase"]) => ({
    environmentId: "env-1",
    threadId: "thread-1",
    threadTitle: "Fix the composer",
    projectTitle: "no3ycode",
    provider: "codex",
    phase,
    updatedAt: "2026-11-22T12:00:00.000Z",
    deepLink: "/threads/env-1/thread-1",
  });
  const props = (phase: Parameters<typeof row>[0], activeCount = 1): No3yLiveActivityProps => ({
    activeCount,
    waitingCount: 0,
    failedCount: 0,
    doneCount: 0,
    updatedAt: "2026-11-22T12:00:00.000Z",
    rows: [row(phase)],
  });
  const now = Date.parse("2026-11-22T12:00:00.000Z");

  it("builds updates that go stale and ends that dismiss, as expo-widgets content state", () => {
    const update = liveActivityRequest("update", props("running"), now);
    expect(update).toEqual({
      priority: "5",
      payload: {
        aps: {
          timestamp: now / 1000,
          event: "update",
          "content-state": { name: "No3yAgentActivity", props: JSON.stringify(props("running")) },
          "stale-date": now / 1000 + 600,
        },
      },
    });
    expect(liveActivityRequest("update", props("waiting_for_input"), now).priority).toBe("10");
    const end = liveActivityRequest("end", props("completed", 0), now);
    expect(end.priority).toBe("10");
    expect(end.payload.aps).toMatchObject({ event: "end", "dismissal-date": now / 1000 + 300 });
    expect(liveActivityRequest("end", null, now).payload.aps).toEqual({
      timestamp: now / 1000,
      event: "end",
      "dismissal-date": now / 1000 + 15,
    });
  });

  it("coalesces updates and holds the end through a continuation", () => {
    using _timers = { [Symbol.dispose]: () => vi.useRealTimers() };
    vi.useFakeTimers();
    let current: No3yLiveActivityProps | null = props("running");
    const pushed: string[] = [];
    const publisher = makeLiveActivityPublisher(
      () => current,
      (event, p) => pushed.push(`${event}:${p?.rows[0]?.phase ?? "none"}`),
      false,
    );
    publisher.changed();
    publisher.changed();
    vi.advanceTimersByTime(500);
    publisher.changed();
    vi.advanceTimersByTime(500);
    expect(pushed).toEqual(["update:running"]);

    current = props("completed", 0);
    publisher.changed();
    vi.advanceTimersByTime(500);
    current = props("running");
    publisher.changed();
    vi.advanceTimersByTime(5_000);
    expect(pushed).toEqual(["update:running"]);

    current = props("completed", 0);
    publisher.changed();
    vi.advanceTimersByTime(5_500);
    expect(pushed).toEqual(["update:running", "end:completed"]);
  });

  it("stops refreshing while the stream is down and resumes on the next change", () => {
    using _timers = { [Symbol.dispose]: () => vi.useRealTimers() };
    vi.useFakeTimers();
    let current = props("running");
    const pushed: string[] = [];
    const publisher = makeLiveActivityPublisher(
      () => current,
      (event) => pushed.push(event),
      false,
    );
    publisher.changed();
    vi.advanceTimersByTime(4 * 60_000 + 500);
    expect(pushed).toEqual(["update", "update"]);
    publisher.changed();
    publisher.pause();
    vi.advanceTimersByTime(20 * 60_000);
    expect(pushed).toHaveLength(2);
    publisher.changed();
    vi.advanceTimersByTime(4 * 60_000 + 500);
    expect(pushed).toHaveLength(3);

    // A held end cut short by a continuation must not re-arm the refresh while paused.
    current = props("completed", 0);
    publisher.changed();
    vi.advanceTimersByTime(500);
    current = props("running");
    publisher.changed();
    publisher.pause();
    vi.advanceTimersByTime(20 * 60_000);
    expect(pushed).toHaveLength(3);
  });
});

describe("device registration", () => {
  const token = "a".repeat(64);
  it.each([
    ["a production build", "com.noahhendrickson.no3ycode", "com.noahhendrickson.no3ycode"],
    ["a dev build", "com.noahhendrickson.no3ycode.dev", "com.noahhendrickson.no3ycode.dev"],
    ["an app from before topics were sent", undefined, "com.noahhendrickson.no3ycode"],
    ["another app's bundle", "com.t3tools.t3code", null],
  ])("pushes %s on its own topic", (_name, topic, expected) => {
    const registration = parseRegistration(JSON.stringify({ token, topic }));
    expect(registration?.topic ?? null).toBe(expected);
  });
});

it("sends a payload the app's notification tap handler opens", () => {
  const payload = apnsPayload({
    title: "t",
    body: "b",
    environmentId: "env-1",
    threadId: "thread-1",
    deepLink: "/threads/env-1/thread-1",
  });
  const response = { notification: { request: { content: { data: payload.body } } } };
  expect(extractAgentNotificationDeepLink(response)).toBe("/threads/env-1/thread-1");
});

describe("automation runs that make no thread stay silent", () => {
  const run = { threadId: "thread-1", latestRunId: "run-2", launchedByAutomation: false };
  const user = (runId: string, scheduledTaskId?: string) => ({
    type: "user_message",
    runId,
    ...(scheduledTaskId ? { scheduledTaskId } : {}),
  });

  it.each([
    [
      "an automation posting into a thread with history",
      [user("run-1"), user("run-2", "task")],
      false,
      true,
    ],
    ["an automation run whose history is paged out", [user("run-2", "task")], true, true],
    ["an automation run that started the thread", [user("run-2", "task")], false, false],
    ["the owner's own message", [user("run-1"), user("run-2")], false, false],
  ])("%s", (_name, turnItems, hasMoreHistory, silent) => {
    expect(isAutomationRunWithoutThread(run, { turnItems, hasMoreHistory })).toBe(silent);
  });

  it("alerts for a run of a thread the automation launched", () => {
    expect(
      isAutomationRunWithoutThread(
        { ...run, launchedByAutomation: true },
        { turnItems: [user("run-1"), user("run-2", "task")], hasMoreHistory: false },
      ),
    ).toBe(false);
  });
});

it("reads the token from a pairing link", () => {
  expect(pairingTokenFromUrl("https://mac.tail.ts.net/#token=abc123")).toBe("abc123");
});
