import {
  EnvironmentId,
  MessageId,
  ProjectId,
  ProviderInstanceId,
  ThreadId,
} from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";

import { DraftId } from "~/composerDraftStore";

import {
  coordinateCommandAvailable,
  coordinatorFirstSendTurns,
  sendCoordinatorFirstTurn,
  isCoordinatorDraft,
  setCoordinatorDraft,
} from "./coordinatorDraft";
import {
  COORDINATOR_START_BEFORE_TASK_MESSAGE,
  COORDINATOR_START_MESSAGE,
} from "./coordinatorThreads";
import { switchCoordinator } from "./useSetCoordinator";

const ownerText = "flaky-test";
const threadId = ThreadId.make("thread-1");
const modelSelection = { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5" };
const bootstrap = {
  createThread: {
    projectId: ProjectId.make("project-1"),
    title: ownerText,
    modelSelection,
    runtimeMode: "full-access",
    interactionMode: "default",
    branch: null,
    worktreePath: null,
    createdAt: "2026-11-27T10:00:00.000Z",
  },
} as const;
const command = {
  environmentId: EnvironmentId.make("env-1"),
  input: {
    threadId,
    message: {
      messageId: MessageId.make("owner"),
      role: "user",
      text: ownerText,
      attachments: [],
    },
    modelSelection,
    titleSeed: ownerText,
    runtimeMode: "full-access",
    interactionMode: "default",
    dispatchMode: "steer",
    bootstrap,
    createdAt: "2026-11-27T10:00:01.000Z",
  },
} as Parameters<typeof coordinatorFirstSendTurns>[0];

describe("coordinatorFirstSendTurns", () => {
  it("creates the thread with the rules, then queues the owner's own message behind them", () => {
    const { rules, task } = coordinatorFirstSendTurns(command, MessageId.make("rules"));
    expect(rules.input.message).toEqual({
      messageId: MessageId.make("rules"),
      role: "user",
      text: COORDINATOR_START_BEFORE_TASK_MESSAGE,
      attachments: [],
    });
    expect(rules.input.bootstrap).toBe(bootstrap);
    expect(rules.input.dispatchMode).toBeUndefined();
    // The rules never title the thread, and land just before the owner's message.
    expect(rules.input.titleSeed).toBeUndefined();
    expect(rules.input.createdAt).toBe("2026-11-27T10:00:00.999Z");

    expect(task.input.message).toBe(command.input.message);
    expect(task.input.bootstrap).toBeUndefined();
    expect(task.input.dispatchMode).toBe("queue");
    expect(task.input.titleSeed).toBe(ownerText);
    expect(task.input.createdAt).toBe(command.input.createdAt);
    expect(task.input.threadId).toBe(threadId);
  });

  it("asks for a one-word reply when the task follows, and one line otherwise", () => {
    expect(COORDINATOR_START_BEFORE_TASK_MESSAGE).toMatch(
      /My first task is my next message\.[^\n]*$/,
    );
    expect(COORDINATOR_START_MESSAGE).toMatch(/Reply in one line that you're coordinating\.$/);
  });
});

describe("coordinateCommandAvailable", () => {
  it("lets a draft switch on without an environment scope, and a thread only with one", () => {
    const base = { draftOn: false, threadCanStart: true };
    // A fresh draft with no project yet has no operate scope; its switch is still a local flag.
    expect(coordinateCommandAvailable({ ...base, draft: true, canOperate: false })).toBe(true);
    expect(
      coordinateCommandAvailable({ ...base, draft: true, draftOn: true, canOperate: false }),
    ).toBe(false);
    expect(coordinateCommandAvailable({ ...base, draft: false, canOperate: true })).toBe(true);
    expect(coordinateCommandAvailable({ ...base, draft: false, canOperate: false })).toBe(false);
    expect(
      coordinateCommandAvailable({
        ...base,
        draft: false,
        canOperate: true,
        threadCanStart: false,
      }),
    ).toBe(false);
  });
});

describe("coordinator draft switch", () => {
  it("holds per draft, and a draft reopened on a new thread starts switched off", () => {
    const draftId = DraftId.make("draft-1");
    expect(isCoordinatorDraft(draftId, threadId)).toBe(false);
    setCoordinatorDraft(draftId, threadId, true);
    expect(isCoordinatorDraft(draftId, threadId)).toBe(true);
    expect(isCoordinatorDraft(DraftId.make("draft-2"), threadId)).toBe(false);
    expect(isCoordinatorDraft(draftId, ThreadId.make("thread-2"))).toBe(false);
    setCoordinatorDraft(draftId, threadId, false);
    expect(isCoordinatorDraft(draftId, threadId)).toBe(false);
  });
});

const success = { _tag: "Success" } as const;
const failure = { _tag: "Failure" } as const;

describe("sendCoordinatorFirstTurn", () => {
  const turns = coordinatorFirstSendTurns(command, MessageId.make("rules"));

  it("stops before the task when the thread could not be tagged, keeping the switch", async () => {
    const startTurn = vi.fn(async () => success);
    const sent = vi.fn();
    const result = await sendCoordinatorFirstTurn(turns, {
      startTurn,
      tag: async () => failure,
      sent,
    });
    expect(result).toBe(failure);
    expect(startTurn.mock.calls).toEqual([[turns.rules]]);
    expect(sent).not.toHaveBeenCalled();
  });

  it("sends the task after the rules and the tag, then clears the switch", async () => {
    const startTurn = vi.fn(async () => success);
    const sent = vi.fn();
    await sendCoordinatorFirstTurn(turns, { startTurn, tag: async () => success, sent });
    expect(startTurn.mock.calls).toEqual([[turns.rules], [turns.task]]);
    expect(sent).toHaveBeenCalledOnce();
  });
});

describe("switchCoordinator", () => {
  it.each([true, false])(
    "puts the tag back when the rules could not be sent (on: %s)",
    async (on) => {
      const setTag = vi.fn(async (_tagged: boolean) => success);
      await switchCoordinator(on, { setTag, tell: async () => false });
      expect(setTag.mock.calls).toEqual([[on], [!on]]);
    },
  );

  it("keeps the tag once the rules are sent, and sends nothing when tagging failed", async () => {
    const setTag = vi.fn(async (_tagged: boolean) => success);
    await switchCoordinator(true, { setTag, tell: async () => true });
    expect(setTag.mock.calls).toEqual([[true]]);
    const tell = vi.fn(async () => true);
    await switchCoordinator(true, { setTag: async () => failure, tell });
    expect(tell).not.toHaveBeenCalled();
  });
});
