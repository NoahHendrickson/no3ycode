/**
 * A chat becomes a thread at its first send; this tags that thread `chat` — see
 * `.fork/customizations.yaml#fork-chat-mode`.
 *
 * Started from the app root, beside the drafts' own promotion, so a chat is tagged wherever
 * the user is. From the send until the tag shows on the thread's shell, the thread's key is in
 * the sent-chats set, which keeps it in Chat: the draft that says so can finalize before the
 * thread or its tag arrives. One try per chat; a failure says so and leaves the thread in Code.
 */
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { AtomCommandResult } from "@t3tools/client-runtime/state/runtime";
import { isAtomCommandInterrupted, runAtomCommand } from "@t3tools/client-runtime/state/runtime";
import type { ScopedThreadRef } from "@t3tools/contracts";
import type { Atom, AtomRegistry } from "effect/reactivity";
import { useSyncExternalStore } from "react";

import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { type DraftSessionState, useComposerDraftStore } from "~/composerDraftStore";
import { appAtomRegistry } from "~/rpc/atomRegistry";
import { environmentThreadShells, threadEnvironment } from "~/state/threads";

import { CHAT_THREAD_TAG, isChatDraft } from "./chatMode";

interface SentChat {
  readonly release: () => void;
  tagging: boolean;
}

const sentChats = new Map<string, SentChat>();
const NO_SENT_CHATS: ReadonlySet<string> = new Set();
let snapshot: ReadonlySet<string> = NO_SENT_CHATS;
const listeners = new Set<() => void>();

function publish() {
  snapshot = sentChats.size === 0 ? NO_SENT_CHATS : new Set(sentChats.keys());
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const readSentChats = (): ReadonlySet<string> => snapshot;

export function useSentChats(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, readSentChats, readSentChats);
}

/** Drops a thread from the sent set, as when it moves between the modes. */
export function forgetSentChat(threadKey: string): void {
  const entry = sentChats.get(threadKey);
  if (entry === undefined) return;
  sentChats.delete(threadKey);
  entry.release();
  publish();
}

export function startChatThreadTagging(input: {
  readonly registry: AtomRegistry.AtomRegistry;
  readonly threadShellAtom: (ref: ScopedThreadRef) => Atom.Atom<EnvironmentThreadShell | null>;
  readonly setTag: (ref: ScopedThreadRef) => Promise<AtomCommandResult<unknown, unknown>>;
}): () => void {
  // Each sent chat is tracked once: its draft can outlive a failed or moved tag.
  const seen = new Set<string>();
  const track = (ref: ScopedThreadRef) => {
    const key = scopedThreadKey(ref);
    if (seen.has(key)) return;
    seen.add(key);
    const atom = input.threadShellAtom(ref);
    const onShell = (shell: EnvironmentThreadShell | null) => {
      const entry = sentChats.get(key);
      if (shell === null || entry === undefined) return;
      if (shell.source.tags?.includes(CHAT_THREAD_TAG)) {
        forgetSentChat(key);
        return;
      }
      if (entry.tagging) return;
      entry.tagging = true;
      void input.setTag(ref).then((result) => {
        if (result._tag === "Success" || sentChats.get(key) !== entry) return;
        forgetSentChat(key);
        if (isAtomCommandInterrupted(result)) return;
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: "Could not file this chat under Chat",
            description: "It is listed in Code; its menu can move it to Chat.",
          }),
        );
      });
    };
    sentChats.set(key, { release: input.registry.subscribe(atom, onShell), tagging: false });
    publish();
    onShell(input.registry.get(atom));
  };
  const trackSent = (drafts: Readonly<Record<string, DraftSessionState>>) => {
    for (const draft of Object.values(drafts)) {
      if (draft.promotedTo != null && isChatDraft(draft)) track(draft.promotedTo);
    }
  };
  trackSent(useComposerDraftStore.getState().draftThreadsByThreadKey);
  const unsubscribe = useComposerDraftStore.subscribe((state, previous) => {
    if (state.draftThreadsByThreadKey !== previous.draftThreadsByThreadKey) {
      trackSent(state.draftThreadsByThreadKey);
    }
  });
  return () => {
    unsubscribe();
    for (const key of seen) forgetSentChat(key);
  };
}

/** The app's tagger, on the app's registry and thread shells. */
export function startAppChatThreadTagging(): () => void {
  const command = threadEnvironment.setTag;
  return startChatThreadTagging({
    registry: appAtomRegistry,
    threadShellAtom: environmentThreadShells.quietThreadShellAtom,
    setTag: (ref) =>
      runAtomCommand(
        appAtomRegistry,
        command,
        {
          environmentId: ref.environmentId,
          input: { threadId: ref.threadId, tag: CHAT_THREAD_TAG, tagged: true },
        },
        { label: command.label, reportFailure: false, reportDefect: true },
      ),
  });
}
