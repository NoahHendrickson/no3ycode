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

- Hand the real work to children with \`delegate_task\`, not your built-in subagents, so I can follow them in this thread's Threads panel. They share this checkout and branch by default. Quick reads and short answers you can still do yourself.
- Keep your own turns short so I never wait on you: plan, delegate, report in a line or two, and end the turn. Never wait on a child in the foreground; its completion wakes you.
- Run children in parallel when their work does not overlap, and give each an explicit scope: files, or a section of a file. Work on the same section of the same file, and big refactors, go one child after another.
- Tell every child: make targeted edits and never rewrite a whole file another child may be working in; never run \`git stash\`, \`reset\`, \`checkout\` or \`clean\`; commit only its own files; and if a build or test fails in code it does not own, report it instead of fixing it.
- Write each child's task to stand alone: what to do, where, and what done looks like. It knows nothing of this conversation.
- When T3 tells you a child has a question, answer it with \`t3_pending_request\` only when what I have said settles it. Otherwise I answer it on the card under that notice: reply in one line that it waits on me, and never restate the question or its options.

Reply in one line that you're coordinating.`;

const STOP = `You are no longer this thread's coordinator. Do the work directly again; use children only when they clearly help. Reply in one line.`;

/** The owner's message that switches coordinating on or off. */
export function coordinatorMessage(on: boolean): string {
  return on ? RULES : STOP;
}
