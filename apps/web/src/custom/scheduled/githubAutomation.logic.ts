import type { ScheduledTask, ScheduledTaskUpsertSchedule, ProjectId } from "@t3tools/contracts";
import {
  scheduleFromDraft,
  taskToDraft,
  type DraftState,
} from "~/components/settings/scheduledTasksSettings.logic";

export type AutomationDraft = DraftState & {
  readonly githubPrOpened?: boolean;
  readonly githubProjectIds?: ReadonlyArray<string>;
  readonly showInSidebar?: boolean;
};

export function automationTaskToDraft(task: ScheduledTask): AutomationDraft {
  return {
    ...taskToDraft(task),
    githubPrOpened: task.schedule.type === "webhook" && task.schedule.github != null,
    githubProjectIds:
      task.schedule.type === "webhook"
        ? (task.schedule.github?.repositories.map((entry) => entry.projectId) ?? [])
        : [],
    showInSidebar: task.showInSidebar === true,
  };
}

export function automationScheduleFromDraft(
  draft: AutomationDraft,
): ScheduledTaskUpsertSchedule | null {
  if (draft.githubPrOpened)
    return {
      type: "webhook",
      github: {
        repositories: (draft.githubProjectIds ?? []).map((projectId) => ({
          projectId: projectId as ProjectId,
        })),
      },
    };
  const schedule = scheduleFromDraft(draft);
  return schedule?.type === "webhook" ? { ...schedule, github: null } : schedule;
}

/** A GitHub PR trigger runs in whichever listed repository the PR targets, not the task's project. */
export function automationProjectIds(
  task: Pick<ScheduledTask, "projectId" | "schedule">,
): ReadonlyArray<ProjectId> {
  const repositories = task.schedule.type === "webhook" ? task.schedule.github?.repositories : null;
  return repositories?.length ? repositories.map((entry) => entry.projectId) : [task.projectId];
}
