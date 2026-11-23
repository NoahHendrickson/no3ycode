/**
 * Tags a chat sent from the phone `chat`, as the Mac does (apps/web/src/custom/chatTagging.ts), so
 * both Chat lists show it — see `.fork/customizations.yaml#no3y-mobile-redesign`. Until the tag
 * shows, the thread's key stays in the sent set, which keeps it in Chat. One try per chat.
 */
import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import { runAtomCommand } from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { useSyncExternalStore } from "react";

import { appAtomRegistry } from "../src/state/atom-registry";
import { environmentThreadShells, threadEnvironment } from "../src/state/threads";
import { NO3Y_CHAT_THREAD_TAG } from "./no3yChatRule";

const sentChats = new Map<string, () => void>();
const NO_SENT_CHATS: ReadonlySet<string> = new Set();
let snapshot: ReadonlySet<string> = NO_SENT_CHATS;
const listeners = new Set<() => void>();

function publish() {
  snapshot = sentChats.size === 0 ? NO_SENT_CHATS : new Set(sentChats.keys());
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const readSentChats = () => snapshot;

/** Chats sent from this phone whose tag has not shown yet, by scoped thread key. */
export function useNo3ySentChats(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, readSentChats, readSentChats);
}

function forget(key: string) {
  const release = sentChats.get(key);
  if (release === undefined) return;
  sentChats.delete(key);
  release();
  publish();
}

/** Keeps a sent chat in Chat and tags its thread once the server lists it. */
export function tagNo3yChat(environmentId: EnvironmentId, threadId: ThreadId): void {
  const ref = scopeThreadRef(environmentId, threadId);
  const key = scopedThreadKey(ref);
  if (sentChats.has(key)) return;
  const atom = environmentThreadShells.quietThreadShellAtom(ref);
  let tagging = false;
  const onShell = (shell: EnvironmentThreadShell | null) => {
    if (shell === null || !sentChats.has(key)) return;
    if (shell.source.tags?.includes(NO3Y_CHAT_THREAD_TAG)) {
      forget(key);
      return;
    }
    if (tagging) return;
    tagging = true;
    const command = threadEnvironment.setTag;
    void runAtomCommand(
      appAtomRegistry,
      command,
      { environmentId, input: { threadId, tag: NO3Y_CHAT_THREAD_TAG, tagged: true } },
      { label: command.label, reportFailure: true },
    ).then((result) => {
      if (result._tag !== "Success") forget(key);
    });
  };
  sentChats.set(key, appAtomRegistry.subscribe(atom, onShell));
  publish();
  onShell(appAtomRegistry.get(atom));
}
