import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { AtomCommandResult } from "@t3tools/client-runtime/state/runtime";
import { EnvironmentId, ProjectId, ThreadId, type ScopedThreadRef } from "@t3tools/contracts";
import * as Cause from "effect/Cause";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { DraftId, useComposerDraftStore } from "../composerDraftStore";
import { CHAT_DRAFT_LOGICAL_PROJECT_KEY, CHAT_THREAD_TAG } from "./chatMode";
import { readSentChats, startChatThreadTagging } from "./chatTagging";

const environmentId = EnvironmentId.make("env");

function shell(tags: readonly string[] = []) {
  return { source: { tags } } as unknown as EnvironmentThreadShell;
}

function harness(results: Array<AtomCommandResult<unknown, unknown>>) {
  const tasks: Array<() => void> = [];
  const registry = AtomRegistry.make({
    scheduleTask: (task) => {
      tasks.push(task);
      return () => {};
    },
  });
  onTestFinished(() => registry.dispose());
  const flush = () => {
    for (let task = tasks.shift(); task !== undefined; task = tasks.shift()) task();
  };
  const shells = new Map<string, Atom.Writable<EnvironmentThreadShell | null>>();
  const shellAtom = (ref: ScopedThreadRef) => {
    const key = scopedThreadKey(ref);
    let atom = shells.get(key);
    if (!atom) {
      atom = Atom.make<EnvironmentThreadShell | null>(null);
      shells.set(key, atom);
    }
    return atom;
  };
  const tagged: string[] = [];
  const settled: Array<Promise<unknown>> = [];
  useComposerDraftStore.setState({ draftsByThreadKey: {}, draftThreadsByThreadKey: {} });
  onTestFinished(
    startChatThreadTagging({
      registry,
      threadShellAtom: shellAtom,
      setTag: (ref) => {
        tagged.push(scopedThreadKey(ref));
        const result = Promise.resolve(results.shift() ?? AsyncResult.success(undefined));
        settled.push(result);
        return result;
      },
    }),
  );
  return {
    tagged,
    settled: () => Promise.all(settled),
    send(name: string, logicalProjectKey = CHAT_DRAFT_LOGICAL_PROJECT_KEY) {
      const ref = scopeThreadRef(environmentId, ThreadId.make(name));
      useComposerDraftStore.setState((state) => ({
        draftThreadsByThreadKey: {
          ...state.draftThreadsByThreadKey,
          [name]: {
            threadId: ref.threadId,
            environmentId,
            projectId: ProjectId.make("scratch"),
            logicalProjectKey,
            createdAt: "2026-11-12T00:00:00.000Z",
            runtimeMode: "full-access",
            interactionMode: "default",
            branch: null,
            worktreePath: null,
            envMode: "local",
            startFromOrigin: false,
            promotedTo: ref,
          },
        },
      }));
      return scopedThreadKey(ref);
    },
    finalize(name: string) {
      useComposerDraftStore.setState((state) => {
        const { [DraftId.make(name)]: _removed, ...rest } = state.draftThreadsByThreadKey;
        return { draftThreadsByThreadKey: rest };
      });
    },
    arrive(key: string, value: EnvironmentThreadShell) {
      registry.set(shellAtom(scopeThreadRefFromKey(key)), value);
      flush();
    },
  };
}

function scopeThreadRefFromKey(key: string) {
  const [environment, thread] = key.split(":");
  return scopeThreadRef(EnvironmentId.make(environment!), ThreadId.make(thread!));
}

describe("startChatThreadTagging", () => {
  it("keeps a sent chat in Chat until its tag shows, tagging its thread once", async () => {
    const chats = harness([]);
    const key = chats.send("chat-sent");
    const codeKey = chats.send("code-sent", "env:scratch");
    expect(readSentChats().has(key)).toBe(true);
    expect(readSentChats().has(codeKey)).toBe(false);

    // The draft can finalize before its thread arrives.
    chats.finalize("chat-sent");
    chats.arrive(key, shell());
    chats.arrive(key, shell(["other"]));
    chats.arrive(codeKey, shell());
    await chats.settled();
    expect(chats.tagged).toEqual([key]);
    expect(readSentChats().has(key)).toBe(true);

    chats.arrive(key, shell([CHAT_THREAD_TAG]));
    expect(readSentChats().has(key)).toBe(false);
  });

  it("leaves a chat whose tag failed to Code, without trying again", async () => {
    const chats = harness([AsyncResult.failure(Cause.fail("offline"))]);
    const key = chats.send("chat-failed");
    chats.arrive(key, shell());
    await chats.settled();
    expect(readSentChats().has(key)).toBe(false);

    chats.send("chat-failed");
    chats.arrive(key, shell(["other"]));
    await chats.settled();
    expect(chats.tagged).toEqual([key]);
  });
});
