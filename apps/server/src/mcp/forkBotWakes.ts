/**
 * The interval limit on the tasks a bot schedules, bound or not — see
 * `.fork/customizations.yaml#fork-bots`. Every wake is a full model turn on the owner's plan; the
 * owner can lift the limit for a task under Automations, which never goes through `schedule_task`.
 */
import type { ScheduledTaskUpsertSchedule, ThreadId } from "@t3tools/contracts";
import { isForkBotThread } from "@t3tools/shared/forkBotTags";
import * as Effect from "effect/Effect";

import { forkBotActingShell } from "../orchestration-v2/forkBotWork.ts";
import type { ThreadManagementService } from "../orchestration-v2/ThreadManagementService.ts";

const FORK_BOT_MIN_WAKE_INTERVAL_MS = 15 * 60_000;

/** Why `caller` may not schedule a task on `schedule`, or null. The limit holds for anything acting
    for a bot, its subagents included. A fixed time fires at most daily, and one-time and webhook
    schedules have no interval. */
export const forkBotScheduleRefusal = Effect.fn("OrchestratorMcpService.forkBotScheduleRefusal")(
  function* (
    threads: ThreadManagementService["Service"],
    caller: ThreadId | undefined,
    schedule: ScheduledTaskUpsertSchedule,
  ) {
    if (
      caller === undefined ||
      schedule.type !== "interval" ||
      schedule.everyMs >= FORK_BOT_MIN_WAKE_INTERVAL_MS
    ) {
      return null;
    }
    const actor = yield* forkBotActingShell(threads, caller);
    return isForkBotThread(actor?.tags)
      ? `A bot can schedule a task at most every 15 minutes, bound to its thread or not: use everyMs of ${FORK_BOT_MIN_WAKE_INTERVAL_MS} or more, or a fixed time. Your owner can set a shorter interval for this task themselves under Automations.`
      : null;
  },
);
