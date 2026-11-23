import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  newTaskFlowKey,
  pruneNewTaskFlowStates,
  readNewTaskFlowState,
  updateNewTaskFlowState,
} from "../src/features/threads/new-task-flow-state";
import { makeThreadShellFixture } from "../src/test-fixtures";
import { listNo3yChatThreads } from "./mobileStatusGrouping";
import { findNo3yChatProject, isNo3yChatDraftRoute, resolveNo3yChatDraftParams } from "./no3yChat";

const ENV = EnvironmentId.make("env-1");
const SCRATCH_ROOT = "/Users/me/.t3/scratch";

function project(id: string, workspaceRoot: string, environmentId = ENV): EnvironmentProject {
  return { environmentId, id: ProjectId.make(id), workspaceRoot } as EnvironmentProject;
}

describe("no3y chat draft", () => {
  it("hosts the draft on the Chat route only once it carries one", () => {
    expect(isNo3yChatDraftRoute({ name: "No3yChat", params: { draft: { requestId: "r" } } })).toBe(
      true,
    );
    expect(isNo3yChatDraftRoute({ name: "No3yChat" })).toBe(false);
    expect(isNo3yChatDraftRoute({ name: "Thread", params: { draft: { requestId: "r" } } })).toBe(
      false,
    );
  });

  it("keeps the Chat draft's flow alive while it is on the stack", () => {
    const chat = { key: "chat", name: "No3yChat", params: { draft: { requestId: "r1" } } };
    const flowKey = newTaskFlowKey(chat)!;
    updateNewTaskFlowState(flowKey, { draftKey: "new-task:chat" });

    pruneNewTaskFlowStates({ routes: [{ key: "home", name: "Home" }, chat] });
    expect(readNewTaskFlowState(flowKey).draftKey).toBe("new-task:chat");

    // A sent chat gives the route a fresh draft; the old flow goes.
    pruneNewTaskFlowStates({
      routes: [
        { key: "home", name: "Home" },
        { ...chat, params: { draft: { requestId: "r2" } } },
      ],
    });
    expect(readNewTaskFlowState(flowKey).draftKey).toBeNull();
  });

  it("starts chats in the environment's opened No-project workspace", () => {
    const scratch = project("scratch", SCRATCH_ROOT);
    const projects = [project("app", "/Users/me/app"), scratch];
    expect(
      findNo3yChatProject({ environmentId: ENV, projects, scratchWorkspaceRoot: SCRATCH_ROOT }),
    ).toBe(scratch);
    expect(
      findNo3yChatProject({
        environmentId: EnvironmentId.make("env-2"),
        projects,
        scratchWorkspaceRoot: SCRATCH_ROOT,
      }),
    ).toBeNull();
    expect(
      findNo3yChatProject({ environmentId: null, projects, scratchWorkspaceRoot: SCRATCH_ROOT }),
    ).toBeNull();
  });

  it("keeps the route's draft while it names the chat project, else mints a fresh one", () => {
    const scratch = project("scratch", SCRATCH_ROOT);
    const current = { requestId: "r1", environmentId: "env-1", projectId: "scratch" };
    expect(resolveNo3yChatDraftParams(current, scratch, () => "r2")).toBe(current);
    expect(resolveNo3yChatDraftParams(undefined, scratch, () => "r2")).toEqual({
      requestId: "r2",
      environmentId: "env-1",
      projectId: "scratch",
    });
    expect(
      resolveNo3yChatDraftParams({ ...current, projectId: "other" }, scratch, () => "r3")
        ?.requestId,
    ).toBe("r3");
    expect(resolveNo3yChatDraftParams(current, null, () => "r4")).toBeNull();
  });

  it("lists tagged chats and ones sent from here awaiting their tag, newest first, by title", () => {
    const chat = (id: string, title: string, at: string, tags: string[] = []) =>
      makeThreadShellFixture({
        source: { ...makeThreadShellFixture().source, tags },
        environmentId: ENV,
        id: ThreadId.make(id),
        projectId: ProjectId.make("scratch"),
        title,
        createdAt: at,
        updatedAt: at,
        latestUserMessageAt: at,
        latestUserAuthoredMessageAt: at,
      });
    // Started on the Mac: tagged.
    const older = chat("c1", "Regex for dates", "2026-11-22T10:00:00.000Z", ["chat"]);
    // Sent from this phone, tag not shown yet.
    const newer = chat("c2", "Explain CRDTs", "2026-11-22T11:00:00.000Z");
    // A No-project New agent thread is code, as on the Mac.
    const code = chat("t1", "Regex refactor", "2026-11-22T11:30:00.000Z");
    const sentChatKeys = new Set([`${ENV}:c2`]);
    const ids = (searchQuery: string) =>
      listNo3yChatThreads({ threads: [older, code, newer], sentChatKeys, searchQuery }).map(
        (thread) => String(thread.id),
      );
    expect(ids("")).toEqual(["c2", "c1"]);
    expect(ids(" regex ")).toEqual(["c1"]);
  });
});
