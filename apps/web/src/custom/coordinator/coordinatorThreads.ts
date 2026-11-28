/**
 * Coordinator threads — see `.fork/customizations.yaml#fork-coordinator-threads`. An ordinary
 * thread switched to handing its work to delegated children, which its Threads panel lists. The
 * switch is the `coordinator` tag (what is one: shared forkBotTags isForkCoordinatorThread); the
 * standing rules travel as the owner's message when it is switched on.
 */
import { type OrchestrationV2ThreadShell, isListedThreadLineage } from "@t3tools/contracts";
import {
  FORK_BOT_QUIET_REPLY,
  isForkBotThread,
  isForkCoordinatorThread,
} from "@t3tools/shared/forkBotTags";

import { botWorkOwnerId } from "../bots/botWorkRoster";
import { isForkDelegatedTaskChildOf } from "../forkWorkReports";

type CoordinatorShell = Pick<OrchestrationV2ThreadShell, "tags" | "lineage">;

/** A listed thread that is no Petal or sprint, nor one's work: those coordinate by their own rules. */
function canCoordinate(shell: CoordinatorShell): boolean {
  return (
    !isForkBotThread(shell.tags) &&
    botWorkOwnerId(shell) === null &&
    isListedThreadLineage(shell.lineage)
  );
}

/** The threads that still get the "needs input" line at a coordinator's timeline end: all but its
    own delegate_task children whose open request is a question, which is their card in its
    conversation. Side chats, nested delegates and approvals keep their line. */
export function coordinatorChildInputs<
  T extends {
    readonly id: string;
    readonly lineage: CoordinatorShell["lineage"];
    readonly hasPendingApprovals: boolean;
    readonly hasPendingUserInput: boolean;
  },
>(coordinatorId: string, children: ReadonlyArray<T>): ReadonlyArray<T> {
  return children.filter(
    (child) =>
      child.hasPendingApprovals ||
      !child.hasPendingUserInput ||
      !isForkDelegatedTaskChildOf(child, coordinatorId),
  );
}

/** A coordinator the sidebar's Coordinators section lists, and so none of its thread groups. */
export function isListedCoordinator(thread: {
  readonly archivedAt: string | null;
  readonly lineage: CoordinatorShell["lineage"];
  readonly source: { readonly tags?: ReadonlyArray<string> | undefined };
}): boolean {
  return (
    thread.archivedAt === null &&
    isForkCoordinatorThread({ tags: thread.source.tags, lineage: thread.lineage })
  );
}

/** The Coordinators section's threads, oldest first so a coordinator keeps its place. */
export function listSidebarCoordinators<
  T extends Parameters<typeof isListedCoordinator>[0] & { readonly createdAt: string },
>(threads: ReadonlyArray<T>): T[] {
  return threads
    .filter(isListedCoordinator)
    .toSorted((left, right) => left.createdAt.localeCompare(right.createdAt));
}

/** Where the menu would offer "Make coordinator": a thread that can coordinate and does not yet. */
export function canStartCoordinating(shell: CoordinatorShell): boolean {
  return canCoordinate(shell) && !isForkCoordinatorThread(shell);
}

/** The thread menu's switch item; picking it flips the thread's coordinating. */
export const COORDINATOR_MENU_ID = "coordinator" as const;

/** The thread menu's switch, as a spreadable list: empty where the thread cannot coordinate. */
export function coordinatorMenuItems(shell: CoordinatorShell, canOperate: boolean) {
  if (!canCoordinate(shell)) return [];
  return [
    {
      id: COORDINATOR_MENU_ID,
      label: isForkCoordinatorThread(shell) ? "Stop coordinating" : "Make coordinator",
      disabled: !canOperate,
    },
  ];
}

const RULES = `You are now this thread's coordinator. Until I switch it off:

- Hand real work to children with \`delegate_task\`. Don't list or link them; say briefly what you started.
- Keep your turns short and never wait on a child; its completion wakes you. If it just did what I answered, reply exactly "${FORK_BOT_QUIET_REPLY}"; else report it in a line.
- Run children in parallel only when their scopes don't overlap; in turn on the same part of a file. Each makes targeted edits and touches git only for its own files.
- If my instructions settle a child's question, answer it with \`t3_pending_request\`. Else its notice's "ask the user" is not for you: never ask me it yourself or restate the question; reply exactly "${FORK_BOT_QUIET_REPLY}" (I answer on its card).`;

/** The owner's message that switches coordinating on. */
export const COORDINATOR_START_MESSAGE = `${RULES}\n\nReply in one line that you're coordinating.`;

/** The same rules when the owner's first task is queued right behind them, so the turn they cost
    stays one word. */
export const COORDINATOR_START_BEFORE_TASK_MESSAGE = `${RULES}\n\nMy first task is my next message. Reply only "Coordinating." to this one.`;

/** The owner's message that switches coordinating off. */
export const COORDINATOR_STOP_MESSAGE = `You are no longer this thread's coordinator. Do the work directly again; use children only when they clearly help. Reply in one line.`;
