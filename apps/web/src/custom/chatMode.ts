/** Code and Chat — see `.fork/customizations.yaml#fork-chat-mode`. A thread is in the mode it
    was made in. An unsent chat is a draft under Chat's own logical key; its first send makes it a
    thread, which custom/chatTagging tags `chat`. */
import {
  scopedThreadKey,
  scopeProjectRef,
  scopeThreadRef,
} from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import * as Schema from "effect/Schema";

import { type DraftId, type DraftSessionState, useComposerDraftStore } from "~/composerDraftStore";

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

/** The logical project key a chat draft is registered under. Code's No-project draft keeps the
    No-project project's own key, so neither ever reopens the other's empty draft. */
export const CHAT_DRAFT_LOGICAL_PROJECT_KEY = "fork:chat";

export function isChatDraft(
  draft: Pick<DraftSessionState, "logicalProjectKey"> | null | undefined,
): boolean {
  return draft?.logicalProjectKey === CHAT_DRAFT_LOGICAL_PROJECT_KEY;
}

/** Moves a just-opened No-project draft onto Chat's key. An empty chat draft left there before
    gives way, as the store does for any logical project. */
export function claimChatDraft(draftId: DraftId): void {
  const { getDraftSession, setLogicalProjectDraftThreadId } = useComposerDraftStore.getState();
  const draft = getDraftSession(draftId);
  if (draft === null || draft.promotedTo != null || isChatDraft(draft)) return;
  setLogicalProjectDraftThreadId(
    CHAT_DRAFT_LOGICAL_PROJECT_KEY,
    scopeProjectRef(draft.environmentId, draft.projectId),
    draftId,
    { threadId: draft.threadId },
  );
}

/** The chat typed but not yet sent that was started last. */
export function latestUnsentChatDraft(
  drafts: Readonly<Record<string, DraftSessionState>>,
): DraftId | null {
  let latest: { readonly draftId: string; readonly createdAt: string } | null = null;
  for (const [draftId, draft] of Object.entries(drafts)) {
    if (draft.promotedTo != null || !isChatDraft(draft)) continue;
    if (latest === null || draft.createdAt > latest.createdAt) {
      latest = { draftId, createdAt: draft.createdAt };
    }
  }
  return latest === null ? null : (latest.draftId as DraftId);
}

export function shellThreadKey(thread: Pick<EnvironmentThreadShell, "environmentId" | "id">) {
  return scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
}

/** `sentChats`: chats sent from this client whose tag has not shown yet (custom/chatTagging). */
export function isChatThread(
  thread: Pick<EnvironmentThreadShell, "environmentId" | "id" | "source">,
  sentChats: ReadonlySet<string>,
): boolean {
  return (
    thread.source.tags?.includes(CHAT_THREAD_TAG) === true || sentChats.has(shellThreadKey(thread))
  );
}

const MOVE_TO_CHAT = "fork:move-to-chat";
const MOVE_TO_CODE = "fork:move-to-code";
export type ChatModeMoveMenuId = typeof MOVE_TO_CHAT | typeof MOVE_TO_CODE;

/** A thread's way between the modes, last in its context menu. */
export function chatModeMoveMenuItem(mode: ForkSidebarMode): {
  readonly id: ChatModeMoveMenuId;
  readonly label: string;
  readonly separatorBefore: true;
} {
  return mode === "chat"
    ? { id: MOVE_TO_CODE, label: "Move to Code", separatorBefore: true }
    : { id: MOVE_TO_CHAT, label: "Move to Chat", separatorBefore: true };
}

export function isChatModeMoveMenuId(id: string): id is ChatModeMoveMenuId {
  return id === MOVE_TO_CHAT || id === MOVE_TO_CODE;
}

/** The mode a move item sends its thread to. */
export function chatModeMoveTarget(id: ChatModeMoveMenuId): ForkSidebarMode {
  return id === MOVE_TO_CHAT ? "chat" : "code";
}

/** The Settled shelf's paging when its last page was asked for. */
export interface SettledPagingMark {
  readonly pages: ReadonlyMap<string, number>;
  readonly listedCount: number;
  readonly visibleCount: number;
}

/** Chat's Settled shelf pages through every mode's history to find chats, so it stops once a
    page lists none, until Show more asks for more. */
export function settledPagingStalled(mark: SettledPagingMark | null, now: SettledPagingMark) {
  return (
    mark !== null &&
    now.pages.size > 0 &&
    mark.pages === now.pages &&
    mark.visibleCount === now.visibleCount &&
    now.listedCount <= mark.listedCount
  );
}
