/**
 * A bot's work — see `.fork/customizations.yaml#fork-bot-work-threads`. A top-level thread a bot
 * launches carries the tag `bot-work:<bot thread id>`, and a thread launched by one of those (or by
 * a bot's subagent) inherits it, so clients keep the bot's work off the sidebar and in its panel.
 */
import { CommandId, type OrchestrationV2ThreadShell, type ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import { FORK_BOT_THREAD_TAG } from "./forkBotReport.ts";
import type { ThreadManagementService } from "./ThreadManagementService.ts";

/** Must match the web client's `BOT_WORK_TAG_PREFIX` (custom/bots/botWork). */
const FORK_BOT_WORK_TAG_PREFIX = "bot-work:";
/** The thread tag schema's limit (contracts threadTags). */
const THREAD_TAG_MAX_LENGTH = 64;

/** The tag a thread launched by `launcher` carries, or null when the launcher is no bot's. */
function forkBotWorkTag(launcher: Pick<OrchestrationV2ThreadShell, "id" | "tags">): string | null {
  const inherited = launcher.tags?.find((tag) => tag.startsWith(FORK_BOT_WORK_TAG_PREFIX));
  if (inherited !== undefined) return inherited;
  if (launcher.tags?.includes(FORK_BOT_THREAD_TAG) !== true) return null;
  const tag = `${FORK_BOT_WORK_TAG_PREFIX}${launcher.id}`;
  // Bots are made with uuid ids (43 characters here); a longer id simply goes unlinked.
  return tag.length <= THREAD_TAG_MAX_LENGTH ? tag : null;
}

/** Tags a newly launched thread as its launcher's bot's work. Best effort: an unlinked thread
    lists in the sidebar like any other, so a failure here never fails the launch. */
export const linkForkBotWork = Effect.fn("ThreadLaunchService.linkForkBotWork")(
  function* (
    threads: ThreadManagementService["Service"],
    input: {
      readonly commandId: CommandId;
      readonly threadId: ThreadId;
      readonly launchedBy: ThreadId;
    },
  ) {
    const caller = yield* threads.getThreadShell(input.launchedBy);
    // A subagent or side chat stands in for the thread it runs under.
    const launcher =
      caller === null ||
      (caller.lineage.relationshipToParent !== "subagent" && caller.lineage.sideChat !== true)
        ? caller
        : yield* threads.getThreadShell(caller.lineage.rootThreadId);
    const tag = launcher === null ? null : forkBotWorkTag(launcher);
    if (tag === null) return;
    yield* threads.dispatch({
      type: "thread.tag.set",
      commandId: CommandId.make(`${input.commandId}:bot-work`),
      threadId: input.threadId,
      tag,
      tagged: true,
    });
  },
  Effect.catch((error) => Effect.logWarning("fork-bot-work.link-failed", { error })),
);
