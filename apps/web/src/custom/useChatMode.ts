/**
 * Code and Chat's actions — see `.fork/customizations.yaml#fork-chat-mode`.
 */
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import type { EnvironmentId, ScopedThreadRef } from "@t3tools/contracts";
import { useRouter } from "@tanstack/react-router";

import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { type DraftId, useComposerDraftStore } from "~/composerDraftStore";
import { type NewThreadHandler, useNewThreadHandler } from "~/hooks/useHandleNewThread";
import { useScratchProject } from "~/hooks/useScratchProject";
import { useQuietThreadShell } from "~/state/entities";
import { threadEnvironment } from "~/state/threads";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";

import {
  CHAT_THREAD_TAG,
  type ChatModeMoveMenuId,
  chatModeMoveMenuItem,
  chatModeMoveTarget,
  claimChatDraft,
  type ForkSidebarMode,
  isChatDraft,
  isChatThread,
  latestUnsentChatDraft,
  shellThreadKey,
  useForkSidebarMode,
} from "./chatMode";
import { forgetSentChat, useSentChats } from "./chatTagging";
import { useStartNewAgentDraft } from "./useNewAgentDraft";

/** "New chat": a No-project draft, claimed for Chat once it is open. Only the draft the handler
    opened is claimed, so a failed start leaves whatever is on screen as it was. */
export function createStartNewChat(input: {
  readonly environmentId: () => EnvironmentId | null;
  readonly openScratchProject: (
    environmentId: EnvironmentId,
    failureTitle: string,
  ) => Promise<EnvironmentProject | null>;
  readonly handleNewThread: NewThreadHandler;
}): () => Promise<void> {
  return async () => {
    const environmentId = input.environmentId();
    if (environmentId === null) {
      toastManager.add({
        type: "error",
        title: "Could not start a chat",
        description:
          "Chats run in a No-project workspace, on the primary machine or the only connected machine that has one. It is off while T3 Code's data folder is inside a git repository.",
      });
      return;
    }
    const project = await input.openScratchProject(environmentId, "Could not start a chat");
    if (project === null) return;
    const opened = await input
      .handleNewThread(scopeProjectRef(project.environmentId, project.id))
      .catch((error: unknown) => {
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: "Could not start a chat",
            description: error instanceof Error ? error.message : "An error occurred.",
          }),
        );
        return null;
      });
    if (opened !== null) claimChatDraft(opened.draftId);
  };
}

export function useStartNewChat(): () => Promise<void> {
  const { scratchEnvironmentId, openScratchProject } = useScratchProject();
  const handleNewThread = useNewThreadHandler();
  return createStartNewChat({
    // The primary machine wins, else the one machine offering a No-project workspace.
    environmentId: () => scratchEnvironmentId(null),
    openScratchProject,
    handleNewThread,
  });
}

/** Moves a thread between the modes by its tag. */
function useMoveThreadToMode(): (
  thread: Pick<EnvironmentThreadShell, "environmentId" | "id">,
  mode: ForkSidebarMode,
) => void {
  const setTag = useOrchestrationCommand(threadEnvironment.setTag);
  return (thread, mode) => {
    void setTag({
      environmentId: thread.environmentId,
      input: { threadId: thread.id, tag: CHAT_THREAD_TAG, tagged: mode === "chat" },
    }).then((result) => {
      if (result._tag === "Success") forgetSentChat(shellThreadKey(thread));
    });
  };
}

/** Switches the sidebar and opens that mode's fresh start: a new chat, or Code's New agent. */
function useSwitchSidebarMode(): [ForkSidebarMode, (next: ForkSidebarMode) => void] {
  const [mode, setMode] = useForkSidebarMode();
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
    const unsent = latestUnsentChatDraft(useComposerDraftStore.getState().draftThreadsByThreadKey);
    if (unsent === null) void startNewChat();
    else void router.navigate({ to: "/draft/$draftId", params: { draftId: unsent } });
  };
  return [mode, switchMode];
}

/** Whether a thread, or the draft reserving it, is a chat. */
export function useIsChatThread(target: ScopedThreadRef | DraftId | null): boolean {
  const sentChats = useSentChats();
  const draftIsChat = useComposerDraftStore((store) =>
    target === null ? false : isChatDraft(store.getDraftThread(target)),
  );
  const shell = useQuietThreadShell(typeof target === "string" ? null : target);
  return draftIsChat || (shell !== null && isChatThread(shell, sentChats));
}

/**
 * How the open mode shapes the sidebar, so Sidebar.tsx reads a field rather than deciding.
 * Chat is one flat list of chats: no projects to strip, scope, group or mark on its rows, and
 * no Working shelf. Code is the sidebar as it was, less the chats.
 */
export function useSidebarModePolicy() {
  const [mode, switchMode] = useSwitchSidebarMode();
  const sentChats = useSentChats();
  const moveThreadToMode = useMoveThreadToMode();
  const chat = mode === "chat";
  return {
    mode,
    switchMode,
    chat,
    /** Off in Chat: the strip, the scope row and its filter, grouping, the rows' project marks. */
    projectControls: !chat,
    workingShelf: !chat,
    grouping: <G extends string>(stored: G): G | "none" => (chat ? "none" : stored),
    /** The one visibility rule for the open mode, for threads and draft rows alike. */
    listsThread: (thread: Pick<EnvironmentThreadShell, "environmentId" | "id" | "source">) =>
      isChatThread(thread, sentChats) === chat,
    threadMenuItem: () => chatModeMoveMenuItem(mode),
    moveThread: (
      thread: Pick<EnvironmentThreadShell, "environmentId" | "id">,
      id: ChatModeMoveMenuId,
    ) => moveThreadToMode(thread, chatModeMoveTarget(id)),
  };
}
