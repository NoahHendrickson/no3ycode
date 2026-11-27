/**
 * Starting a thread as a coordinator — see `.fork/customizations.yaml#fork-coordinator-threads`.
 * A new-thread draft holds the switch until it is sent. Its first send creates the thread with the
 * standing rules, tags it, and queues the owner's task right behind them, so the first turn that
 * works on the task already coordinates.
 */
import type { MessageId, ScopedThreadRef, ThreadId } from "@t3tools/contracts";
import { create } from "zustand";

import type { DraftId } from "~/composerDraftStore";
import { newMessageId } from "~/lib/utils";
import { useQuietThreadShell } from "~/state/entities";
import { threadEnvironment } from "~/state/threads";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";

import {
  canStartCoordinating,
  coordinatorMessage,
  FORK_COORDINATOR_TAG,
} from "./coordinatorThreads";
import { useSetCoordinator } from "./useSetCoordinator";

interface CoordinatorDraftState {
  /** The draft's thread id, by draft: a draft discarded and opened again starts switched off. */
  readonly byDraft: Readonly<Record<DraftId, ThreadId>>;
}

const useCoordinatorDraftStore = create<CoordinatorDraftState>()(() => ({ byDraft: {} }));

export function setCoordinatorDraft(draftId: DraftId, threadId: ThreadId, on: boolean): void {
  useCoordinatorDraftStore.setState(({ byDraft }) => {
    const { [draftId]: _dropped, ...rest } = byDraft;
    return { byDraft: on ? { ...rest, [draftId]: threadId } : rest };
  });
}

export function isCoordinatorDraft(draftId: DraftId, threadId: ThreadId): boolean {
  return useCoordinatorDraftStore.getState().byDraft[draftId] === threadId;
}

type StartTurnCommand = Parameters<typeof threadEnvironment.startTurn.run>[1];

/** The first send as two turns: the rules create the thread (with the draft's bootstrap), and the
    owner's own message queues behind them. Only the task seeds the title. */
export function coordinatorFirstSendTurns(
  command: StartTurnCommand,
  rulesMessageId: MessageId,
): { readonly rules: StartTurnCommand; readonly task: StartTurnCommand } {
  const { message, bootstrap, dispatchMode: _dispatchMode, titleSeed, ...rest } = command.input;
  const rulesCreatedAt =
    rest.createdAt === undefined
      ? {}
      : { createdAt: new Date(Date.parse(rest.createdAt) - 1).toISOString() };
  return {
    rules: {
      environmentId: command.environmentId,
      input: {
        ...rest,
        ...rulesCreatedAt,
        message: {
          messageId: rulesMessageId,
          role: "user",
          text: coordinatorMessage(true, true),
          attachments: [],
        },
        ...(bootstrap === undefined ? {} : { bootstrap }),
      },
    },
    task: {
      environmentId: command.environmentId,
      input: {
        ...rest,
        message,
        ...(titleSeed === undefined ? {} : { titleSeed }),
        dispatchMode: "queue",
      },
    },
  };
}

/** Wraps the composer's turn start: a draft switched to coordinating sends its rules first. */
export function useCoordinatorDraftStart<R extends { readonly _tag: string }>(
  startTurn: (command: StartTurnCommand) => Promise<R>,
  draftId: DraftId | null,
): (command: StartTurnCommand) => Promise<R> {
  const setTag = useOrchestrationCommand(threadEnvironment.setTag);
  return async (command) => {
    const { environmentId, input } = command;
    if (draftId === null || !isCoordinatorDraft(draftId, input.threadId)) return startTurn(command);
    const turns = coordinatorFirstSendTurns(command, newMessageId());
    const rules = await startTurn(turns.rules);
    if (rules._tag !== "Success") return rules;
    setCoordinatorDraft(draftId, input.threadId, false);
    await setTag({
      environmentId,
      input: { threadId: input.threadId, tag: FORK_COORDINATOR_TAG, tagged: true },
    });
    return startTurn(turns.task);
  };
}

/** Where `/coordinate` applies. A draft's switch is a local flag, so it needs no environment
    scope (a draft with no project yet has none); the send checks permission. A thread's switch
    sends a command, so it does. */
export function coordinateCommandAvailable(input: {
  readonly draft: boolean;
  readonly draftOn: boolean;
  readonly canOperate: boolean;
  readonly threadCanStart: boolean;
}): boolean {
  return input.draft ? !input.draftOn : input.canOperate && input.threadCanStart;
}

/** The composer's way in: the draft's toggle, and `/coordinate` wherever it can apply. */
export function useCoordinatorComposer(input: {
  readonly draft: { readonly draftId: DraftId; readonly threadId: ThreadId } | null;
  readonly threadRef: ScopedThreadRef | null;
  readonly canOperate: boolean;
}) {
  const { draft, canOperate } = input;
  const draftOn = useCoordinatorDraftStore(
    (state) => draft !== null && state.byDraft[draft.draftId] === draft.threadId,
  );
  const shell = useQuietThreadShell(draft === null ? input.threadRef : null);
  const setCoordinator = useSetCoordinator();
  const setDraftOn = (on: boolean) => {
    if (draft !== null) setCoordinatorDraft(draft.draftId, draft.threadId, on);
  };
  const commandAvailable = coordinateCommandAvailable({
    draft: draft !== null,
    draftOn,
    canOperate,
    threadCanStart: shell !== null && canStartCoordinating(shell.source),
  });
  return {
    /** Null off a new-thread draft, where no toggle shows. */
    toggle: draft === null ? null : { on: draftOn, setOn: setDraftOn },
    commandAvailable,
    runCommand: () => {
      if (!commandAvailable) return;
      if (draft !== null) setDraftOn(true);
      else if (shell !== null) void setCoordinator(shell, true);
    },
  };
}
