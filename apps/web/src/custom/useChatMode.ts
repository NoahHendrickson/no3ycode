/**
 * Code and Chat's actions — see `.fork/customizations.yaml#fork-chat-mode`.
 */
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import type { EnvironmentId, ScopedProjectRef, ScopedThreadRef } from "@t3tools/contracts";
import { useRouter } from "@tanstack/react-router";

import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { type DraftId, useComposerDraftStore } from "~/composerDraftStore";
import { type NewThreadHandler, useNewThreadHandler } from "~/hooks/useHandleNewThread";
import { useScratchProject } from "~/hooks/useScratchProject";
import { useProjects, useQuietThreadShell } from "~/state/entities";
import { useEnvironments, usePrimaryEnvironmentId } from "~/state/environments";
import { threadEnvironment } from "~/state/threads";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";

import {
  CHAT_THREAD_TAG,
  claimChatDraft,
  type ForkSidebarMode,
  isChatDraft,
  isChatThread,
  latestUnsentChatDraft,
  shellThreadKey,
  threadsForSidebarMode,
  useForkSidebarMode,
} from "./chatMode";
import { forgetSentChat, useSentChats } from "./chatTagging";
import { useStartNewAgentDraft } from "./useNewAgentDraft";

/** "New chat": a No-project draft, claimed for Chat once it is open. Only the draft the handler
    opened is claimed, so a failed start leaves whatever is on screen as it was. */
export function createStartNewChat(input: {
  readonly environmentId: () => EnvironmentId | null;
  readonly fallbackProject: () => ScopedProjectRef | null;
  readonly openScratchProject: (
    environmentId: EnvironmentId,
    failureTitle: string,
  ) => Promise<EnvironmentProject | null>;
  readonly handleNewThread: NewThreadHandler;
}): () => Promise<void> {
  return async () => {
    const environmentId = input.environmentId();
    let projectRef = environmentId === null ? input.fallbackProject() : null;
    if (environmentId !== null) {
      const project = await input.openScratchProject(environmentId, "Could not start a chat");
      if (project === null) return;
      projectRef = scopeProjectRef(project.environmentId, project.id);
    }
    if (projectRef === null) {
      toastManager.add({
        type: "error",
        title: "Could not start a chat",
        description:
          "No machine offers No-project chats. They are off while T3 Code's data folder is inside a git repository.",
      });
      return;
    }
    const opened = await input.handleNewThread(projectRef).catch((error: unknown) => {
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
  const { scratchEnvironmentId, scratchWorkspaceRootFor, openScratchProject } = useScratchProject();
  const { environments } = useEnvironments();
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const projects = useProjects();
  const handleNewThread = useNewThreadHandler();
  return createStartNewChat({
    // The primary machine's No-project workspace, else any connected machine's.
    environmentId: () =>
      scratchEnvironmentId(primaryEnvironmentId) ??
      environments
        .map((environment) => environment.environmentId)
        .find((id) => scratchWorkspaceRootFor(id) !== null) ??
      null,
    // No machine reports one: a No-project project that already exists still hosts a chat.
    fallbackProject: () => {
      const project = projects.find((candidate) => candidate.isScratch === true);
      return project ? scopeProjectRef(project.environmentId, project.id) : null;
    },
    openScratchProject,
    handleNewThread,
  });
}

/** Moves a thread between the modes by its tag. */
export function useMoveThreadToMode(): (
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
export function useSwitchSidebarMode(): [ForkSidebarMode, (next: ForkSidebarMode) => void] {
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

/** The current mode's threads; the compiler keeps the list while its inputs hold. */
export function useSidebarModeThreads<
  T extends Pick<EnvironmentThreadShell, "environmentId" | "id" | "source">,
>(threads: readonly T[], mode: ForkSidebarMode): T[] {
  const sentChats = useSentChats();
  return threadsForSidebarMode(threads, mode, sentChats);
}

/** Whether a thread (or the draft reserving it) is a chat. */
export function useIsChatThread(ref: ScopedThreadRef | null): boolean {
  const sentChats = useSentChats();
  const draftIsChat = useComposerDraftStore((store) =>
    ref === null ? false : isChatDraft(store.getDraftThreadByRef(ref)),
  );
  const shell = useQuietThreadShell(ref);
  return draftIsChat || (shell !== null && isChatThread(shell, sentChats));
}

/** Whether a draft is a chat not yet sent. */
export function useIsChatDraft(draftId: DraftId | null): boolean {
  return useComposerDraftStore((store) =>
    draftId === null ? false : isChatDraft(store.getDraftSession(draftId)),
  );
}
