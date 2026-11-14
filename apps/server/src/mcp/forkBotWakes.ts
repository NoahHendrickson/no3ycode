/**
 * Limits on the wakes a bot schedules for its own thread — see `.fork/customizations.yaml#fork-bots`.
 * Every wake is a full model turn on the owner's plan; the owner can lift either limit for a task
 * under Automations, which never goes through `schedule_task`.
 */
import type {
  ModelSelection,
  ScheduledTaskUpsertSchedule,
  ServerProvider,
} from "@t3tools/contracts";

const FORK_BOT_MIN_WAKE_INTERVAL_MS = 15 * 60_000;

/** Why a bot may not wake itself on `schedule`, or null. A fixed time fires at most daily, and
    one-time and webhook schedules have no interval. */
export function forkBotWakeScheduleRefusal(schedule: ScheduledTaskUpsertSchedule): string | null {
  return schedule.type === "interval" && schedule.everyMs < FORK_BOT_MIN_WAKE_INTERVAL_MS
    ? `A bot can wake itself at most every 15 minutes: use everyMs of ${FORK_BOT_MIN_WAKE_INTERVAL_MS} or more, or a fixed time. Your owner can set a shorter interval for this task themselves under Automations.`
    : null;
}

/** The newest current Sonnet of the bot's Claude instance, without options, so a chat on a pricier
    model does not carry into every wake. Same pick as the web's bot creation; otherwise unchanged. */
export function forkBotWakeModelSelection(
  selection: ModelSelection,
  providers: ReadonlyArray<ServerProvider>,
): ModelSelection {
  const provider = providers.find((candidate) => candidate.instanceId === selection.instanceId);
  if (provider?.driver !== "claudeAgent") return selection;
  const sonnet = provider.models.find(
    (model) => model.isLegacy !== true && model.slug.includes("sonnet"),
  );
  return sonnet === undefined || sonnet.slug === selection.model
    ? selection
    : { instanceId: selection.instanceId, model: sonnet.slug };
}
