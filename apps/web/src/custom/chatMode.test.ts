import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { DraftId, useComposerDraftStore } from "../composerDraftStore";
import { CHAT_THREAD_TAG, isChatDraft, isChatThread } from "./chatMode";
import { createStartNewChat } from "./useChatMode";

const thread = (id: string, tags?: readonly string[]) =>
  ({
    environmentId: "env",
    id,
    source: tags === undefined ? {} : { tags },
  }) as unknown as Parameters<typeof isChatThread>[0];

describe("isChatThread", () => {
  const tagged = thread("tagged", [CHAT_THREAD_TAG, "other"]);
  const sent = thread("sent");
  const code = thread("code", ["other"]);
  const untagged = thread("untagged");
  const threads = [tagged, sent, code, untagged];
  const sentChats = new Set(["env:sent"]);

  it("is a chat when tagged, or sent from here and not yet tagged", () => {
    expect(threads.filter((entry) => isChatThread(entry, sentChats))).toEqual([tagged, sent]);
  });
});

describe("createStartNewChat", () => {
  const environmentId = EnvironmentId.make("env");
  const scratchRef = scopeProjectRef(environmentId, ProjectId.make("scratch"));
  const scratchKey = "env:scratch";
  const scratchProject = { environmentId, id: scratchRef.projectId } as EnvironmentProject;

  function setup() {
    useComposerDraftStore.setState({
      draftsByThreadKey: {},
      draftThreadsByThreadKey: {},
      logicalProjectDraftThreadKeyByLogicalProjectKey: {},
    });
    // What the No-project handler does: open a draft in the No-project project's own slot.
    let opened = 0;
    const openDraft = async () => {
      opened += 1;
      const draftId = DraftId.make(`draft-${opened}`);
      const threadId = ThreadId.make(`thread-${opened}`);
      useComposerDraftStore
        .getState()
        .setLogicalProjectDraftThreadId(scratchKey, scratchRef, draftId, { threadId });
      return { draftId, threadId };
    };
    return { openDraft };
  }

  it("claims the draft it opened for Chat, out of the slot Code's No project reuses", async () => {
    const { openDraft } = setup();
    await createStartNewChat({
      environmentId: () => environmentId,
      openScratchProject: async () => scratchProject,
      handleNewThread: openDraft,
    })();
    const store = useComposerDraftStore.getState();
    expect(isChatDraft(store.getDraftSession(DraftId.make("draft-1")))).toBe(true);
    expect(store.getDraftSessionByLogicalProjectKey(scratchKey)).toBeNull();
  });

  it("claims nothing when the start fails, whatever draft is open", async () => {
    const { openDraft } = setup();
    const open = await openDraft();
    for (const failing of [
      { openScratchProject: async () => null, handleNewThread: openDraft },
      { openScratchProject: async () => scratchProject, handleNewThread: async () => null },
    ]) {
      await createStartNewChat({
        environmentId: () => environmentId,
        ...failing,
      })();
    }
    const store = useComposerDraftStore.getState();
    expect(isChatDraft(store.getDraftSession(open.draftId))).toBe(false);
    expect(store.getDraftSessionByLogicalProjectKey(scratchKey)?.draftId).toBe(open.draftId);
  });
});
