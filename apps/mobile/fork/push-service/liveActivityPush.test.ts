import { describe, expect, it, vi } from "vite-plus/test";

import type { No3yLiveActivityProps } from "../no3yLiveActivity";
import type { Delivery, PushToken } from "./apns.mts";
import { liveActivityRequest, makeLiveActivityService } from "./liveActivityPush.mts";

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

const props = (
  phase: Parameters<typeof row>[0],
  activeCount = 1,
  waitingCount = 0,
): No3yLiveActivityProps => ({
  activeCount,
  waitingCount,
  failedCount: 0,
  doneCount: 0,
  updatedAt: "2026-11-22T12:00:00.000Z",
  rows: [row(phase)],
  tiles: [],
});

const token = (letter: string): PushToken => ({
  token: letter.repeat(64),
  environment: "production",
  topic: "com.noahhendrickson.no3ycode",
  registeredAt: "2026-11-22T12:00:00.000Z",
});

function harness(initial: ReadonlyArray<string> = ["a"]) {
  let tokens = initial.map(token);
  let current: No3yLiveActivityProps | null = props("running");
  let outcome: Delivery = "sent";
  let stall: Promise<void> | null = null;
  const pushed: string[] = [];
  /** The first row's phase on each end, to tell one run's finish from another's. */
  const ended: string[] = [];
  const service = makeLiveActivityService({
    store: {
      read: () => [...tokens],
      update: (change) => {
        tokens = change([...tokens]);
      },
    },
    read: () => current,
    deliver: async (to, request) => {
      const aps = (
        request.payload as { aps: { event: string; "content-state"?: { props: string } } }
      ).aps;
      pushed.push(`${aps.event}:${to.token[0]}`);
      const card = aps["content-state"]?.props;
      if (aps.event === "end" && card) ended.push(JSON.parse(card).rows[0].phase);
      const wait = stall;
      stall = null;
      if (wait) await wait;
      return outcome;
    },
    holdMs: 5_000,
    log: () => {},
  });
  return {
    service,
    pushed,
    ended,
    tokens: () => tokens.map((t) => t.token[0]),
    show: (next: No3yLiveActivityProps | null) => {
      current = next;
    },
    deliverAs: (next: Delivery) => {
      outcome = next;
    },
    /** The next delivery hangs until the returned function is called. */
    stallNext: () => {
      let release = () => {};
      stall = new Promise<void>((resolve) => {
        release = resolve;
      });
      return () => release();
    },
  };
}

const fakeTimers = () => {
  vi.useFakeTimers();
  return { [Symbol.dispose]: () => vi.useRealTimers() };
};

describe("live activity pushes", () => {
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
    expect(liveActivityRequest("update", props("waiting_for_input", 1, 1), now).priority).toBe(
      "10",
    );
    const end = liveActivityRequest("end", props("completed", 0), now);
    expect(end.priority).toBe("10");
    expect(end.payload.aps).toMatchObject({ event: "end", "dismissal-date": now / 1000 + 300 });
    expect(liveActivityRequest("end", null, now).payload.aps).toEqual({
      timestamp: now / 1000,
      event: "end",
      "dismissal-date": now / 1000 + 15,
    });
  });

  it("pushes nothing before the first snapshot, then the card to each token once", async () => {
    using _timers = fakeTimers();
    const h = harness();
    h.service.register(token("b"));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(h.pushed).toEqual([]);

    h.service.resume();
    await vi.advanceTimersByTimeAsync(500);
    expect(h.pushed).toEqual(["update:a", "update:b"]);
    h.service.changed();
    await vi.advanceTimersByTimeAsync(500);
    h.service.register(token("c"));
    await vi.advanceTimersByTimeAsync(500);
    expect(h.pushed).toEqual(["update:a", "update:b", "update:c"]);
  });

  it("holds the end through a continuation, then ends and forgets every token", async () => {
    using _timers = fakeTimers();
    const h = harness();
    h.service.resume();
    await vi.advanceTimersByTimeAsync(500);

    h.show(props("completed", 0));
    h.service.changed();
    await vi.advanceTimersByTimeAsync(500);
    h.show(props("running"));
    h.service.changed();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(h.pushed).toEqual(["update:a"]);

    h.show(props("completed", 0));
    h.service.changed();
    await vi.advanceTimersByTimeAsync(5_500);
    expect(h.pushed).toEqual(["update:a", "end:a"]);
    expect(h.tokens()).toEqual([]);
  });

  it("drops a queued end when work is back by the time its turn comes", async () => {
    using _timers = fakeTimers();
    const h = harness();
    const release = h.stallNext();
    h.service.resume();
    await vi.advanceTimersByTimeAsync(500);
    h.show(props("completed", 0));
    h.service.changed();
    await vi.advanceTimersByTimeAsync(5_500);
    h.show(props("running"));
    release();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(h.pushed).toEqual(["update:a"]);
    expect(h.tokens()).toEqual(["a"]);
  });

  it("checks before each token's end, not once per batch", async () => {
    using _timers = fakeTimers();
    const h = harness(["a", "b"]);
    h.service.resume();
    await vi.advanceTimersByTimeAsync(500);
    h.show(props("completed", 0));
    h.service.changed();
    const release = h.stallNext();
    await vi.advanceTimersByTimeAsync(5_500);
    h.show(props("running"));
    release();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(h.pushed).toEqual(["update:a", "update:b", "end:a"]);
    expect(h.tokens()).toEqual(["b"]);
  });

  it("ends with the latest run's finish when a newer run came and went behind a stalled push", async () => {
    using _timers = fakeTimers();
    const h = harness();
    const release = h.stallNext();
    h.service.resume();
    await vi.advanceTimersByTimeAsync(500);
    h.show(props("failed", 0));
    h.service.changed();
    await vi.advanceTimersByTimeAsync(5_500);
    // The newer run starts and finishes inside one coalescing window.
    h.show(props("running"));
    h.service.changed();
    h.show(props("completed", 0));
    await vi.advanceTimersByTimeAsync(5_500);
    release();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(h.ended).toEqual(["completed"]);
    expect(h.tokens()).toEqual([]);
  });

  it("lets the snapshot after a reconnect decide the end, not one queued before it", async () => {
    using _timers = fakeTimers();
    const h = harness();
    const release = h.stallNext();
    h.service.resume();
    await vi.advanceTimersByTimeAsync(500);
    h.show(props("failed", 0));
    h.service.changed();
    await vi.advanceTimersByTimeAsync(5_500);
    h.service.pause();
    h.show(props("completed", 0));
    h.service.resume();
    // The stalled push clears while the fresh snapshot's own hold is still running.
    await vi.advanceTimersByTimeAsync(1_000);
    release();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(h.ended).toEqual(["completed"]);
    expect(h.tokens()).toEqual([]);
  });

  it("gives a card registered during a hold the whole hold for its run to show", async () => {
    using _timers = fakeTimers();
    const h = harness();
    h.show(null);
    h.service.resume();
    await vi.advanceTimersByTimeAsync(4_750);
    h.service.register(token("b"));
    await vi.advanceTimersByTimeAsync(1_000);
    expect(h.pushed).toEqual([]);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(h.pushed).toEqual(["end:a", "end:b"]);
  });

  it("keeps a token whose end failed and ends it on the next change", async () => {
    using _timers = fakeTimers();
    const h = harness();
    h.show(null);
    h.deliverAs("failed");
    // A token left from a previous run gets its end through the same hold.
    h.service.resume();
    await vi.advanceTimersByTimeAsync(5_500);
    expect(h.pushed).toEqual(["end:a"]);
    expect(h.tokens()).toEqual(["a"]);

    h.deliverAs("sent");
    h.service.changed();
    await vi.advanceTimersByTimeAsync(5_500);
    expect(h.pushed).toEqual(["end:a", "end:a"]);
    expect(h.tokens()).toEqual([]);
  });

  it("stops while the stream is down and re-sends the card as soon as it is back", async () => {
    using _timers = fakeTimers();
    const h = harness();
    h.service.resume();
    await vi.advanceTimersByTimeAsync(4 * 60_000 + 500);
    expect(h.pushed).toEqual(["update:a", "update:a"]);

    h.service.changed();
    h.service.pause();
    await vi.advanceTimersByTimeAsync(20 * 60_000);
    expect(h.pushed).toHaveLength(2);
    // The card went stale while the stream was down, so the unchanged card goes out again.
    h.service.resume();
    await vi.advanceTimersByTimeAsync(500);
    expect(h.pushed).toHaveLength(3);

    // A held end is dropped by a pause rather than sent on stale knowledge.
    h.show(props("completed", 0));
    h.service.changed();
    await vi.advanceTimersByTimeAsync(500);
    h.service.pause();
    await vi.advanceTimersByTimeAsync(20 * 60_000);
    expect(h.pushed).toHaveLength(3);
  });
});
