import type { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { ProviderInstanceId, RuntimeRequestId, ScheduledTaskId } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { describe, expect, it, vi } from "vite-plus/test";

import { extractAgentNotificationDeepLink } from "../../src/features/agent-awareness/notificationPayload";
import {
  apnsPayload,
  isAutomationRunWithoutThread,
  makeTracker,
  observeThread,
  pairingTokenFromUrl,
  parseRegistration,
  type ApnsNotification,
} from "./no3yPush.mts";

function tracker() {
  const sent: ApnsNotification[] = [];
  const t = makeTracker("env-1" as EnvironmentId, (notification) => sent.push(notification));
  t.projectTitles.set("project-1", "no3ycode");
  return Object.assign(t, { sent });
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
