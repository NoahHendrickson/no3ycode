import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import type { AgentAwarenessState } from "@t3tools/shared/agentAwareness";
import { describe, expect, it } from "vite-plus/test";

import {
  aggregateNo3yLiveActivity,
  NO3Y_LIVE_ACTIVITY_TERMINAL_TTL_MS,
  no3yLiveActivitySignature,
} from "./no3yLiveActivity";

const now = Date.parse("2026-11-24T12:00:00.000Z");

const input = (
  threadId: string,
  phase: AgentAwarenessState["phase"],
  updatedAt = "2026-11-24T11:59:00.000Z",
) => ({
  provider: "claudeAgent",
  state: {
    environmentId: "env-1" as EnvironmentId,
    threadId: threadId as ThreadId,
    projectTitle: "no3ycode",
    threadTitle: threadId,
    phase,
    headline: "",
    modelTitle: "",
    updatedAt,
    deepLink: `/threads/env-1/${threadId}`,
  },
});

describe("aggregateNo3yLiveActivity", () => {
  it("puts waiting threads first, then failures, running work, and recent finishes, counting all", () => {
    const card = aggregateNo3yLiveActivity(
      [
        input("done", "completed", "2026-11-24T11:58:00.000Z"),
        input("running", "running"),
        input("failed", "failed"),
        input("input", "waiting_for_input"),
        input("approval", "waiting_for_approval", "2026-11-24T11:59:30.000Z"),
      ],
      now,
    );
    // Three rows fit the lock screen; the counts still cover the two that don't.
    expect(card?.rows.map((row) => row.threadId)).toEqual(["approval", "input", "failed"]);
    expect(card).toMatchObject({ activeCount: 3, waitingCount: 2, failedCount: 1, doneCount: 1 });
    expect(card?.updatedAt).toBe("2026-11-24T11:59:30.000Z");
  });

  it("drops finished rows after their display window, and stale rows always", () => {
    const old = new Date(now - NO3Y_LIVE_ACTIVITY_TERMINAL_TTL_MS - 1).toISOString();
    expect(aggregateNo3yLiveActivity([input("done", "completed", old)], now)).toBeNull();
    expect(aggregateNo3yLiveActivity([input("stale", "stale")], now)).toBeNull();
    expect(aggregateNo3yLiveActivity([input("done", "completed")], now)?.activeCount).toBe(0);
  });

  it("bounds titles so the pushed card fits ActivityKit's 4 KB payload", () => {
    for (const title of [
      "長".repeat(180),
      "\u0001".repeat(180),
      "\u0001".repeat(80),
      "\ud800".repeat(80),
    ]) {
      const long = (id: string) => {
        const item = input(id, "running");
        return { ...item, state: { ...item.state, threadTitle: title, projectTitle: title } };
      };
      const card = aggregateNo3yLiveActivity([long("a"), long("b"), long("c")], now);
      expect(card?.rows[0]?.threadTitle).toHaveLength(80);
      const contentState = JSON.stringify({
        name: "No3yAgentActivity",
        props: JSON.stringify(card),
      });
      expect(new TextEncoder().encode(contentState).byteLength).toBeLessThan(3_500);
    }
  });

  it("signs what the card shows, not when the shell last changed", () => {
    const at = (updatedAt: string) =>
      no3yLiveActivitySignature(aggregateNo3yLiveActivity([input("t", "running", updatedAt)], now));
    expect(at("2026-11-24T11:59:00.000Z")).toBe(at("2026-11-24T11:59:59.000Z"));
    expect(
      no3yLiveActivitySignature(aggregateNo3yLiveActivity([input("t", "waiting_for_input")], now)),
    ).not.toBe(at("2026-11-24T11:59:00.000Z"));
  });
});
