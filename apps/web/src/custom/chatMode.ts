/** Code and Chat — see `.fork/customizations.yaml#fork-chat-mode`. A thread is in the mode it
    was made in: Chat's carry the `chat` tag, set at the first send; until then a chat's
    reserved thread key waits in a pending list, so its draft already sits in Chat. */
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import * as Schema from "effect/Schema";
import { useSyncExternalStore } from "react";

import { getLocalStorageItem, setLocalStorageItem } from "~/hooks/useLocalStorage";

import { createForkRootSetting } from "./forkRootSetting";

export type ForkSidebarMode = "code" | "chat";

/** The server-side tag that puts a thread in Chat. */
export const CHAT_THREAD_TAG = "chat";

const FORK_SIDEBAR_MODE_ATTRIBUTE = "data-fork-sidebar-mode";

export const { initialize: initializeForkSidebarMode, useValue: useForkSidebarMode } =
  createForkRootSetting<ForkSidebarMode, ForkSidebarMode>({
    storageKey: "t3code:fork:sidebar-mode:v1",
    attribute: FORK_SIDEBAR_MODE_ATTRIBUTE,
    schema: Schema.Literals(["code", "chat"]),
    defaultValue: "code",
    attributeValue: (mode) => mode,
  });

const PENDING_CHATS_STORAGE_KEY = "t3code:fork:pending-chat-threads:v1";
const PendingChats = Schema.Array(Schema.String);
const NO_PENDING_CHATS: ReadonlySet<string> = new Set();
const pendingListeners = new Set<() => void>();
let pendingSnapshot: ReadonlySet<string> | null = null;

function readPendingChats(): ReadonlySet<string> {
  if (pendingSnapshot !== null) return pendingSnapshot;
  try {
    const stored = getLocalStorageItem(PENDING_CHATS_STORAGE_KEY, PendingChats);
    pendingSnapshot = stored && stored.length > 0 ? new Set(stored) : NO_PENDING_CHATS;
  } catch {
    pendingSnapshot = NO_PENDING_CHATS;
  }
  return pendingSnapshot;
}

function writePendingChats(next: ReadonlySet<string>): void {
  pendingSnapshot = next.size === 0 ? NO_PENDING_CHATS : next;
  try {
    setLocalStorageItem(PENDING_CHATS_STORAGE_KEY, [...next], PendingChats);
  } catch (error) {
    console.error("[fork-chat-mode] Could not store pending chats.", error);
  }
  for (const listener of pendingListeners) listener();
}

/** A chat started but not yet sent, by its reserved thread key. */
export function addPendingChat(threadKey: string): void {
  const current = readPendingChats();
  if (current.has(threadKey)) return;
  writePendingChats(new Set([...current, threadKey]));
}

export function removePendingChat(threadKey: string): void {
  const current = readPendingChats();
  if (!current.has(threadKey)) return;
  const next = new Set(current);
  next.delete(threadKey);
  writePendingChats(next);
}

function subscribePendingChats(listener: () => void): () => void {
  pendingListeners.add(listener);
  return () => {
    pendingListeners.delete(listener);
  };
}

export function usePendingChats(): ReadonlySet<string> {
  return useSyncExternalStore(subscribePendingChats, readPendingChats, () => NO_PENDING_CHATS);
}

export function shellThreadKey(thread: Pick<EnvironmentThreadShell, "environmentId" | "id">) {
  return scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
}

export function isChatThread(
  thread: Pick<EnvironmentThreadShell, "environmentId" | "id" | "source">,
  pendingChats: ReadonlySet<string>,
): boolean {
  return (
    thread.source.tags?.includes(CHAT_THREAD_TAG) === true ||
    pendingChats.has(shellThreadKey(thread))
  );
}

/** The threads a mode's sidebar lists: Chat's only, or everything else. */
export function threadsForSidebarMode<
  T extends Pick<EnvironmentThreadShell, "environmentId" | "id" | "source">,
>(threads: readonly T[], mode: ForkSidebarMode, pendingChats: ReadonlySet<string>): T[] {
  return threads.filter((thread) => isChatThread(thread, pendingChats) === (mode === "chat"));
}

export type ChatModeMoveMenuId = "fork:move-to-chat" | "fork:move-to-code";

/** A thread's way between the modes, last in its context menu. */
export function chatModeMoveMenuItem(mode: ForkSidebarMode): {
  readonly id: ChatModeMoveMenuId;
  readonly label: string;
  readonly separatorBefore: true;
} {
  return mode === "chat"
    ? { id: "fork:move-to-code", label: "Move to Code", separatorBefore: true }
    : { id: "fork:move-to-chat", label: "Move to Chat", separatorBefore: true };
}

/** The current mode's threads; the compiler keeps the list while its inputs hold. */
export function useSidebarModeThreads<
  T extends Pick<EnvironmentThreadShell, "environmentId" | "id" | "source">,
>(threads: readonly T[], mode: ForkSidebarMode): T[] {
  const pendingChats = usePendingChats();
  return threadsForSidebarMode(threads, mode, pendingChats);
}
