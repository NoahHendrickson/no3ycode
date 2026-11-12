/**
 * Code and Chat's actions — see `.fork/customizations.yaml#fork-chat-mode`.
 */
import {
  scopedThreadKey,
  scopeProjectRef,
  scopeThreadRef,
} from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { toastManager } from "~/components/ui/toast";
import { type DraftId, useComposerDraftStore } from "~/composerDraftStore";
import { useNewThreadHandler } from "~/hooks/useHandleNewThread";
import { useScratchProject } from "~/hooks/useScratchProject";
import { useProjects, useQuietThreadShell } from "~/state/entities";
import { useEnvironments, usePrimaryEnvironmentId } from "~/state/environments";
import { threadEnvironment } from "~/state/threads";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";
import { resolveThreadRouteTarget } from "~/threadRoutes";

import {
  addPendingChat,
  CHAT_THREAD_TAG,
  type ForkSidebarMode,
  removePendingChat,
  shellThreadKey,
  useForkSidebarMode,
  usePendingChats,
} from "./chatMode";
import { useStartNewAgentDraft } from "./useNewAgentDraft";

/** "New chat": a No-project draft, remembered as a chat until its first send tags it. */
export function useStartNewChat(): () => Promise<void> {
  const { scratchEnvironmentId, scratchWorkspaceRootFor, startScratchThread } = useScratchProject();
  const { environments } = useEnvironments();
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const projects = useProjects();
  const handleNewThread = useNewThreadHandler();
  const router = useRouter();
  return async () => {
    // The primary machine's No-project workspace, else any connected machine's.
    const environmentId =
      scratchEnvironmentId(primaryEnvironmentId) ??
      environments
        .map((environment) => environment.environmentId)
        .find((id) => scratchWorkspaceRootFor(id) !== null) ??
      null;
    // No machine reports one: a No-project project that already exists still hosts a chat.
    const scratchProject =
      environmentId === null ? projects.find((project) => project.isScratch === true) : undefined;
    if (environmentId !== null) {
      await startScratchThread(environmentId);
    } else if (scratchProject) {
      await handleNewThread(scopeProjectRef(scratchProject.environmentId, scratchProject.id));
    } else {
      toastManager.add({
        type: "error",
        title: "Could not start a chat",
        description:
          "No machine offers No-project chats. They are off while T3 Code's data folder is inside a git repository.",
      });
      return;
    }
    const target = resolveThreadRouteTarget(router.state.matches.at(-1)?.params ?? {});
    if (target?.kind !== "draft") return;
    const session = useComposerDraftStore.getState().getDraftSession(target.draftId);
    if (session) {
      addPendingChat(scopedThreadKey(scopeThreadRef(session.environmentId, session.threadId)));
    }
  };
}

/** Tags each pending chat once its server thread exists, then forgets it. */
export function useChatTagSync(threads: readonly EnvironmentThreadShell[]): void {
  const pending = usePendingChats();
  const setTag = useOrchestrationCommand(threadEnvironment.setTag, { reportFailure: false });
  const inFlight = useRef(new Set<string>());
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- tags a pending chat on the server once its thread appears in the shell stream
  useEffect(() => {
    if (pending.size === 0) return;
    for (const thread of threads) {
      const key = shellThreadKey(thread);
      if (!pending.has(key) || inFlight.current.has(key)) continue;
      if (thread.source.tags?.includes(CHAT_THREAD_TAG)) {
        removePendingChat(key);
        continue;
      }
      inFlight.current.add(key);
      void setTag({
        environmentId: thread.environmentId,
        input: { threadId: thread.id, tag: CHAT_THREAD_TAG, tagged: true },
      }).then((result) => {
        inFlight.current.delete(key);
        if (result._tag === "Success") removePendingChat(key);
      });
    }
  }, [threads, pending, setTag]);
}

/** Moves a thread between the modes by its tag. */
export function useMoveThreadToMode(): (
  thread: Pick<EnvironmentThreadShell, "environmentId" | "id">,
  mode: ForkSidebarMode,
) => void {
  const setTag = useOrchestrationCommand(threadEnvironment.setTag);
  return (thread, mode) => {
    removePendingChat(shellThreadKey(thread));
    void setTag({
      environmentId: thread.environmentId,
      input: { threadId: thread.id, tag: CHAT_THREAD_TAG, tagged: mode === "chat" },
    });
  };
}

/** Switches the sidebar and opens that mode's fresh start: a new chat, or Code's New agent. */
export function useSwitchSidebarMode(): [ForkSidebarMode, (next: ForkSidebarMode) => void] {
  const [mode, setMode] = useForkSidebarMode();
  const pending = usePendingChats();
  const startNewChat = useStartNewChat();
  const startNewAgentDraft = useStartNewAgentDraft();
  const router = useRouter();
  const switchMode = (next: ForkSidebarMode) => {
    if (next === mode) return;
    setMode(next);
    if (next === "code") {
      void startNewAgentDraft();
      return;
    }
    // A chat typed but not sent is where Chat was left; reopen it rather than a blank one.
    const unsent = latestUnsentChatDraft(pending);
    if (unsent === null) void startNewChat();
    else void router.navigate({ to: "/draft/$draftId", params: { draftId: unsent } });
  };
  return [mode, switchMode];
}

function latestUnsentChatDraft(pending: ReadonlySet<string>): DraftId | null {
  let latest: { readonly draftId: DraftId; readonly createdAt: string } | null = null;
  const drafts = useComposerDraftStore.getState().draftThreadsByThreadKey;
  for (const [draftId, draft] of Object.entries(drafts)) {
    if (draft.promotedTo != null) continue;
    if (!pending.has(scopedThreadKey(scopeThreadRef(draft.environmentId, draft.threadId))))
      continue;
    if (latest === null || draft.createdAt > latest.createdAt) {
      latest = { draftId: draftId as DraftId, createdAt: draft.createdAt };
    }
  }
  return latest?.draftId ?? null;
}

/** Whether a thread (or the draft reserving it) is a chat. */
export function useIsChatThread(ref: ScopedThreadRef | null): boolean {
  const pending = usePendingChats();
  const shell = useQuietThreadShell(ref);
  if (ref === null) return false;
  return (
    pending.has(scopedThreadKey(ref)) || shell?.source.tags?.includes(CHAT_THREAD_TAG) === true
  );
}

/** Whether a draft is a chat started in Chat and not yet sent. */
export function useIsChatDraft(draftId: DraftId | null): boolean {
  const pending = usePendingChats();
  const threadKey = useComposerDraftStore((store) => {
    const session = draftId === null ? null : store.getDraftSession(draftId);
    return session
      ? scopedThreadKey(scopeThreadRef(session.environmentId, session.threadId))
      : null;
  });
  return threadKey !== null && pending.has(threadKey);
}
