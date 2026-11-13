/** A bot card's status line, in place of the model and branch — see `.fork/customizations.yaml#fork-bots`. */
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";

import { ScheduledRelativeLabel } from "~/components/settings/ScheduledTasksSettings";
import { useEnvironmentQuery } from "~/state/query";
import { serverEnvironment } from "~/state/server";

import { type BotThreadFields, botStatusLine } from "./botThreads";

export function BotCardStatusLine(props: {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly thread: BotThreadFields;
  readonly status: string;
}) {
  // One live list per environment, shared with the details card's Automations.
  const tasks = useEnvironmentQuery(
    serverEnvironment.scheduledTasksLive({ environmentId: props.environmentId, input: {} }),
  ).data?.tasks;
  const nextWakeAt =
    (tasks ?? [])
      .flatMap((task) =>
        task.threadId === props.threadId && task.enabled && task.nextRunAt !== null
          ? [task.nextRunAt]
          : [],
      )
      .toSorted()[0] ?? null;
  const line = botStatusLine({ thread: props.thread, status: props.status, nextWakeAt });
  return (
    <div
      data-testid="sidebar-v2-bot-status-line"
      // The palette's hook for the card's second line, so Glass inks it like the meta it replaces.
      data-fork-thread-card-meta=""
      className="h-3.5 min-w-0 truncate text-[0.75rem] leading-3.5 text-muted-foreground"
    >
      {"text" in line ? (
        line.text
      ) : (
        <>
          {"Next check "}
          <ScheduledRelativeLabel value={line.nextWakeAt} />
        </>
      )}
    </div>
  );
}
