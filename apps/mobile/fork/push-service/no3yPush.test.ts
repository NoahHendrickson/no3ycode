import type { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { ProviderInstanceId, RuntimeRequestId } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { describe, expect, it, vi } from "vite-plus/test";

import { extractAgentNotificationDeepLink } from "../../src/features/agent-awareness/notificationPayload";
import {
  apnsPayload,
  observeThread,
  pairingTokenFromUrl,
  type ApnsNotification,
  type Tracker,
} from "./no3yPush.mts";

function tracker(): Tracker & { readonly sent: ApnsNotification[] } {
  const sent: ApnsNotification[] = [];
  return {
    sent,
    environmentId: "env-1" as EnvironmentId,
    notify: (notification) => sent.push(notification),
    projectTitles: new Map([["project-1", "no3ycode"]]),
    lastKeys: new Map(),
    settleTimers: new Map(),
  };
}

const thread = (
  overrides: Partial<Pick<Parameters<typeof observeThread>[1], "status" | "pendingRuntimeRequest">>,
) => ({
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
  ...overrides,
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

it("reads the token from a pairing link", () => {
  expect(pairingTokenFromUrl("https://mac.tail.ts.net/#token=abc123")).toBe("abc123");
});
