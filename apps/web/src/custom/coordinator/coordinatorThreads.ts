/**
 * Coordinator threads — see `.fork/customizations.yaml#fork-coordinator-threads`. An ordinary
 * thread the owner switches to coordinating: it hands the work to delegated children on its own
 * checkout and branch, and its Threads panel lists them. The switch is the `coordinator` tag; the
 * standing rules travel as the owner's message when it is switched on.
 */
import { type OrchestrationV2ThreadShell, isListedThreadLineage } from "@t3tools/contracts";
import { isForkBotThread } from "@t3tools/shared/forkBotTags";

export const FORK_COORDINATOR_TAG = "coordinator";

export function isCoordinatorThread(shell: {
  readonly tags?: ReadonlyArray<string> | undefined;
}): boolean {
  return shell.tags?.includes(FORK_COORDINATOR_TAG) === true;
}

type CoordinatorShell = Pick<OrchestrationV2ThreadShell, "tags" | "lineage">;

/** A listed thread that is no Petal or sprint: those already coordinate by their own rules. */
function canCoordinate(shell: CoordinatorShell): boolean {
  return !isForkBotThread(shell.tags) && isListedThreadLineage(shell.lineage);
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

- Hand real work to children with \`delegate_task\`, so I can follow them in this thread's panel.
- Keep your own turns short and never wait on a child; its completion wakes you.
- Run children in parallel only when their scopes don't overlap; work on the same section of a file goes one child after another. Tell each child to make targeted edits and touch git only for its own files.
- When a child asks something my instructions don't settle, say in one line that it waits on me (I answer on the card), and never restate the question.

Reply in one line that you're coordinating.`;

const STOP = `You are no longer this thread's coordinator. Do the work directly again; use children only when they clearly help. Reply in one line.`;

/** The owner's message that switches coordinating on or off. */
export function coordinatorMessage(on: boolean): string {
  return on ? RULES : STOP;
}
