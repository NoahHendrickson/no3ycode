/**
 * Starting a thread as a coordinator — see `.fork/customizations.yaml#fork-coordinator-threads`.
 * A new-thread draft holds the switch until it is sent. Its first send creates the thread with the
 * standing rules, tags it, and queues the owner's task right behind them, so the first turn that
 * works on the task already coordinates.
 */
import type { MessageId, ScopedThreadRef, ThreadId } from "@t3tools/contracts";
import { FORK_COORDINATOR_TAG } from "@t3tools/shared/forkBotTags";
import { create } from "zustand";

import type { DraftId } from "~/composerDraftStore";
import { newMessageId } from "~/lib/utils";
import { useQuietThreadShell } from "~/state/entities";
import { threadEnvironment } from "~/state/threads";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";

import { canStartCoordinating, COORDINATOR_START_BEFORE_TASK_MESSAGE } from "./coordinatorThreads";
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
  // Both turns carry the draft's send time, and the server lists messages by createdAt, then by
  // their (random) ids, so the rules go a millisecond earlier to always show first.
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
          text: COORDINATOR_START_BEFORE_TASK_MESSAGE,
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

type Outcome = { readonly _tag: string };

/** A coordinator draft's first send: the rules create the thread, the tag makes it a coordinator,
    then the owner's task follows. A failed step stops it, so the composer keeps the task in the
    draft and reports the failure; only a sent task clears the switch. */
export async function sendCoordinatorFirstTurn<R extends Outcome, T extends Outcome>(
  turns: ReturnType<typeof coordinatorFirstSendTurns>,
  steps: {
    readonly startTurn: (command: StartTurnCommand) => Promise<R>;
    readonly tag: () => Promise<T>;
    readonly sent: () => void;
  },
): Promise<R | T> {
  const rules = await steps.startTurn(turns.rules);
  if (rules._tag !== "Success") return rules;
  // Rules on an untagged thread make no coordinator; the task waits in the draft instead.
  const tagged = await steps.tag();
  if (tagged._tag !== "Success") return tagged;
  const task = await steps.startTurn(turns.task);
  if (task._tag === "Success") steps.sent();
  return task;
}

/** Wraps the composer's turn start: a draft switched to coordinating sends its rules first. */
export function useCoordinatorDraftStart<R extends Outcome>(
  startTurn: (command: StartTurnCommand) => Promise<R>,
  draftId: DraftId | null,
) {
  const setTag = useOrchestrationCommand(threadEnvironment.setTag, { reportFailure: false });
  return async (command: StartTurnCommand) => {
    const { environmentId, input } = command;
    if (draftId === null || !isCoordinatorDraft(draftId, input.threadId)) return startTurn(command);
    return sendCoordinatorFirstTurn(coordinatorFirstSendTurns(command, newMessageId()), {
      startTurn,
      tag: () =>
        setTag({
          environmentId,
          input: { threadId: input.threadId, tag: FORK_COORDINATOR_TAG, tagged: true },
        }),
      sent: () => setCoordinatorDraft(draftId, input.threadId, false),
    });
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
