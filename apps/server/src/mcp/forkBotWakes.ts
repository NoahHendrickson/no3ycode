/**
 * The interval limit on the tasks a bot schedules, bound or not — see
 * `.fork/customizations.yaml#fork-bots`. Every wake is a full model turn on the owner's plan; the
 * owner can lift the limit for a task under Automations, which never goes through `schedule_task`.
 */
import type { ScheduledTaskUpsertSchedule } from "@t3tools/contracts";

const FORK_BOT_MIN_WAKE_INTERVAL_MS = 15 * 60_000;

/** Why a bot may not schedule a task on `schedule`, or null. A fixed time fires at most daily, and
    one-time and webhook schedules have no interval. */
export function forkBotWakeScheduleRefusal(schedule: ScheduledTaskUpsertSchedule): string | null {
  return schedule.type === "interval" && schedule.everyMs < FORK_BOT_MIN_WAKE_INTERVAL_MS
    ? `A bot can schedule a task at most every 15 minutes, bound to its thread or not: use everyMs of ${FORK_BOT_MIN_WAKE_INTERVAL_MS} or more, or a fixed time. Your owner can set a shorter interval for this task themselves under Automations.`
    : null;
}
