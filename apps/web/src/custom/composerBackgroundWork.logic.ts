/** The collapse that still holds: a task it has not seen spends it, so the drawer reopens and stays open. */
export function resolveCollapsedTaskIds(
  tasks: ReadonlyArray<{ readonly taskId: string }>,
  collapsedTaskIds: ReadonlySet<string> | null,
): ReadonlySet<string> | null {
  if (collapsedTaskIds === null) return null;
  return tasks.every((task) => collapsedTaskIds.has(task.taskId)) ? collapsedTaskIds : null;
}
