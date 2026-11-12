/**
 * Code and Chat's actions — see `.fork/customizations.yaml#fork-chat-mode`.
 */
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { DraftId } from "~/composerDraftStore";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { filterSidebarV2VisibleThreads } from "~/components/Sidebar.logic";
import { toastManager } from "~/components/ui/toast";
import { useComposerDraftStore } from "~/composerDraftStore";
import { useScratchProject } from "~/hooks/useScratchProject";
import { threadEnvironment } from "~/state/threads";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";
import { buildThreadRouteParams, resolveThreadRouteTarget } from "~/threadRoutes";

import {
  addPendingChat,
  CHAT_THREAD_TAG,
  type ForkSidebarMode,
  removePendingChat,
  shellThreadKey,
  threadRecency,
  threadsForSidebarMode,
  useForkSidebarMode,
  usePendingChats,
} from "./chatMode";

type Route =
  | { readonly kind: "server"; readonly thread: EnvironmentThreadShell }
  | {
      readonly kind: "draft";
      readonly draftId: DraftId;
    };

/** Where each mode was left, so switching back returns there. Per window. */
const lastRouteByMode = new Map<ForkSidebarMode, string>();

function currentRouteKey(router: ReturnType<typeof useRouter>): string | null {
  const target = resolveThreadRouteTarget(router.state.matches.at(-1)?.params ?? {});
  if (target === null) return null;
  return target.kind === "server" ? scopedThreadKey(target.threadRef) : `draft:${target.draftId}`;
}

/** "New chat": a No-project draft, remembered as a chat until its first send tags it. */
export function useStartNewChat(): () => Promise<void> {
  const { scratchEnvironmentId, startScratchThread } = useScratchProject();
  const router = useRouter();
  return async () => {
    const environmentId = scratchEnvironmentId(null);
    if (environmentId === null) {
      toastManager.add({
        type: "error",
        title: "Could not start a chat",
        description: "No connected machine offers a No-project workspace.",
      });
      return;
    }
    await startScratchThread(environmentId);
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

/**
 * Switches the sidebar and goes where that mode was left: the thread it had
 * open, else its latest thread, else (Chat) a new chat or (Code) home.
 */
export function useSwitchSidebarMode(
  threads: readonly EnvironmentThreadShell[],
): [ForkSidebarMode, (next: ForkSidebarMode) => void] {
  const [mode, setMode] = useForkSidebarMode();
  const pending = usePendingChats();
  const startNewChat = useStartNewChat();
  const router = useRouter();
  const switchMode = (next: ForkSidebarMode) => {
    if (next === mode) return;
    const leaving = currentRouteKey(router);
    if (leaving !== null) lastRouteByMode.set(mode, leaving);
    setMode(next);

    const listed = threadsForSidebarMode(
      filterSidebarV2VisibleThreads(threads, null, new Set()),
      next,
      pending,
    );
    const remembered = lastRouteByMode.get(next);
    const route: Route | null = (() => {
      if (remembered?.startsWith("draft:")) {
        const draftId = remembered.slice("draft:".length) as DraftId;
        const session = useComposerDraftStore.getState().getDraftSession(draftId);
        return session && !session.promotedTo ? { kind: "draft", draftId } : null;
      }
      const thread =
        listed.find((candidate) => shellThreadKey(candidate) === remembered) ??
        listed.toSorted((left, right) =>
          threadRecency(right).localeCompare(threadRecency(left)),
        )[0];
      return thread ? { kind: "server", thread } : null;
    })();

    if (route?.kind === "draft") {
      void router.navigate({ to: "/draft/$draftId", params: { draftId: route.draftId } });
    } else if (route?.kind === "server") {
      void router.navigate({
        to: "/$environmentId/$threadId",
        params: buildThreadRouteParams(scopeThreadRef(route.thread.environmentId, route.thread.id)),
      });
    } else if (next === "chat") {
      void startNewChat();
    } else {
      void router.navigate({ to: "/" });
    }
  };
  return [mode, switchMode];
}
