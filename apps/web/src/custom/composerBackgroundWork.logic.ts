/** The collapse that still holds: a task it has not seen spends it, so the drawer reopens and stays open. */
export function resolveCollapsedTaskIds(
  tasks: ReadonlyArray<{ readonly taskId: string }>,
  collapsedTaskIds: ReadonlySet<string> | null,
): ReadonlySet<string> | null {
  if (collapsedTaskIds === null) return null;
  return tasks.every((task) => collapsedTaskIds.has(task.taskId)) ? collapsedTaskIds : null;
}

/** Whether a subagent approval the drawer has not yet made way for is pending. */
export function hasUnseenApproval(
  approvalIds: ReadonlySet<string>,
  seenApprovalIds: ReadonlySet<string>,
): boolean {
  for (const id of approvalIds) if (!seenApprovalIds.has(id)) return true;
  return false;
}
