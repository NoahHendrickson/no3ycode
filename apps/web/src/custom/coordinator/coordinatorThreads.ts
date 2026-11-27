/**
 * Coordinator threads — see `.fork/customizations.yaml#fork-coordinator-threads`. An ordinary
 * thread the owner switches to coordinating: it hands the work to delegated children on its own
 * checkout and branch, and its Threads panel lists them. The switch is the `coordinator` tag; the
 * standing rules travel as the owner's message when it is switched on.
 */
import { type OrchestrationV2ThreadShell, isListedThreadLineage } from "@t3tools/contracts";
import {
  FORK_COORDINATOR_TAG,
  isForkBotThread,
  isForkCoordinatorThread,
} from "@t3tools/shared/forkBotTags";

export { FORK_COORDINATOR_TAG };

export function isCoordinatorThread(shell: {
  readonly tags?: ReadonlyArray<string> | undefined;
}): boolean {
  return isForkCoordinatorThread(shell.tags);
}

type CoordinatorShell = Pick<OrchestrationV2ThreadShell, "tags" | "lineage">;

/** A listed thread that is no Petal or sprint: those already coordinate by their own rules. */
function canCoordinate(shell: CoordinatorShell): boolean {
  return !isForkBotThread(shell.tags) && isListedThreadLineage(shell.lineage);
}

/** A coordinator the sidebar's Coordinators section lists, and so none of its thread groups. */
export function isListedCoordinator(thread: {
  readonly archivedAt: string | null;
  readonly lineage: CoordinatorShell["lineage"];
  readonly source: { readonly tags?: ReadonlyArray<string> | undefined };
}): boolean {
  return (
    thread.archivedAt === null &&
    isCoordinatorThread(thread.source) &&
    canCoordinate({ tags: thread.source.tags, lineage: thread.lineage })
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
  return canCoordinate(shell) && !isCoordinatorThread(shell);
}

const MENU_ON = "coordinator:on";
const MENU_OFF = "coordinator:off";
type CoordinatorMenuId = typeof MENU_ON | typeof MENU_OFF;

/** The thread menu's switch, as a spreadable list: empty where the thread cannot coordinate. */
export function coordinatorMenuItems(shell: CoordinatorShell, canOperate: boolean) {
  if (!canCoordinate(shell)) return [];
  const on = isCoordinatorThread(shell);
  return [
    {
      id: (on ? MENU_OFF : MENU_ON) as CoordinatorMenuId,
      label: on ? "Stop coordinating" : "Make coordinator",
      disabled: !canOperate,
    },
  ];
}

export function isCoordinatorMenuId(id: string): id is CoordinatorMenuId {
  return id === MENU_ON || id === MENU_OFF;
}

/** Whether a picked switch item turns coordinating on. */
export function coordinatorMenuTurnsOn(id: CoordinatorMenuId): boolean {
  return id === MENU_ON;
}

const RULES = `You are now this thread's coordinator. Until I switch it off:

- Hand real work to children with \`delegate_task\`, so I follow them in this thread's panel. Don't list or link them; say in a few words what you started.
- Keep your own turns short and never wait on a child; its completion wakes you.
- Run children in parallel only when their scopes don't overlap; work on the same section of a file goes one child after another. Tell each child to make targeted edits and touch git only for its own files.
- If my instructions settle a child's question, answer it with \`t3_pending_request\`. Otherwise its notice's "ask the user" is not for you: never ask me it yourself or restate the question; say in one line that it waits on me (I answer on its card).`;

const ACK = "Reply in one line that you're coordinating.";
const ACK_BEFORE_TASK = 'My first task is my next message. Reply only "Coordinating." to this one.';

const STOP = `You are no longer this thread's coordinator. Do the work directly again; use children only when they clearly help. Reply in one line.`;

/** The owner's message that switches coordinating on or off; `taskFollows` when the owner's first
    task is queued right behind it, so the turn it costs stays one word. */
export function coordinatorMessage(on: boolean, taskFollows = false): string {
  return on ? `${RULES}\n\n${taskFollows ? ACK_BEFORE_TASK : ACK}` : STOP;
}
