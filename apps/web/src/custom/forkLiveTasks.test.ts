import { describe, expect, it } from "vite-plus/test";
import type { TimelineEntry } from "~/session-logic";
import { forkLiveTaskSteps } from "./forkLiveTasks";

const at = "2026-01-01T00:00:00Z";
const step = (id: string, status: "pending" | "running" | "completed") => ({
  id,
  text: id,
  status,
});
const tasks = (id: string, steps: ReturnType<typeof step>[]): TimelineEntry => ({
  id,
  kind: "work",
  createdAt: at,
  entry: {
    id,
    createdAt: at,
    label: id,
    tone: "info",
    itemType: "todo_list",
    structuredPayload: { type: "todo_list", steps } as never,
  },
});
const user = (id: string, inputIntent?: "steer"): TimelineEntry => ({
  id,
  kind: "message",
  createdAt: at,
  message: {
    id: id as never,
    role: "user",
    text: id,
    runId: null,
    createdAt: at,
    updatedAt: at,
    streaming: false,
    ...(inputIntent ? { inputIntent } : {}),
  },
});

describe("forkLiveTaskSteps", () => {
  it("reads the turn's latest task list", () => {
    const latest = [step("a", "completed"), step("b", "running")];
    expect(
      forkLiveTaskSteps([
        user("prompt"),
        tasks("first", [step("a", "running")]),
        tasks("next", latest),
      ]),
    ).toBe(latest);
  });

  it("keeps the list through a steer but not past the user's prompt", () => {
    const list = [step("a", "running")];
    expect(forkLiveTaskSteps([user("prompt"), tasks("t", list), user("steer", "steer")])).toBe(
      list,
    );
    expect(forkLiveTaskSteps([tasks("t", list), user("next prompt")])).toBeNull();
  });

  it("starts fresh on a notification-triggered turn", () => {
    const notification: TimelineEntry = {
      id: "wake",
      kind: "work",
      createdAt: at,
      entry: { id: "wake", createdAt: at, label: "wake", tone: "info", itemType: "notification" },
    };
    expect(forkLiveTaskSteps([tasks("t", [step("a", "running")]), notification])).toBeNull();
  });

  it("draws nothing for an empty list", () => {
    expect(forkLiveTaskSteps([user("prompt"), tasks("t", [])])).toBeNull();
  });
});
